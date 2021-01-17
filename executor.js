// @ts-check
const readline = require('readline');
const { PythonCaller, FunctionMissingError } = require('./lib/code-caller-python');

/**
 * @typedef {Object} Request
 * @property {string} type
 * @property {string} directory
 * @property {string} file
 * @property {string} fcn
 * @property {any[]} args
 */

/**
 * @typedef {Object} Results
 * @property {string} [error]
 * @property {any} [data]
 * @property {string} [output]
 * @property {boolean} [functionMissing]
 * @property {boolean} needsFullRestart
 */

/**
 * Receives a single line of input and executes the instructions contained in
 * it in the provided code caller.
 *
 * @param {string} line
 * @param {PythonCaller} caller
 * @returns {Promise<Results>}
 */
async function handleInput(line, caller) {
  return new Promise((resolve, reject) => {
    const request = /** @type {Request} */ (JSON.parse(line));

    if (request.fcn === 'restart') {
      caller.restart((restartErr, success) => {
        resolve({
          data: 'success',
          needsFullRestart: !!restartErr || !success,
        });
      });
      return;
    }

    // Course will always be at `/course` in the Docker executor
    caller.prepareForCourse('/course', (err) => {
      if (err) {
        // TODO: handle err?
      }

      caller.call(
        request.type,
        request.directory,
        request.file,
        request.fcn,
        request.args,
        (err, data, output) => {
          const functionMissing = err instanceof FunctionMissingError;
          resolve({
            // `FunctionMissingError` shouldn't be propagated as an actual error
            // we'll report it via `functionMissing`
            error: err && !functionMissing ? err.message : undefined,
            data,
            output,
            functionMissing,
            needsFullRestart: false,
          });
        },
      );
    });
  });
}

(async () => {
  // Our overall loop looks like this: read a line of input from stdin, spin
  // off a python worker to handle it, and write the results back to stdout.
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  let pc = new PythonCaller({ reportLoad: false });
  pc.ensureChild();

  // Safety check: if we receive more input while handling another request,
  // discard it.
  let processingRequest = false;
  rl.on('line', (line) => {
    if (processingRequest) {
      // Someone else messed up, ignore this line
      return;
    }
    processingRequest = true;
    handleInput(line, pc)
      .then((results) => {
        const { needsFullRestart, ...rest } = results;
        if (needsFullRestart) {
          pc.done();
          pc = new PythonCaller({ reportLoad: false });
          pc.ensureChild();
        }
        console.log(JSON.stringify(rest));
        processingRequest = false;
      })
      .catch((err) => {
        console.error(err);
        processingRequest = false;
      });
  });

  rl.on('close', () => {
    // We can't get any more input; die immediately to allow our container
    // to be removed.
    process.exit(0);
  });
})();