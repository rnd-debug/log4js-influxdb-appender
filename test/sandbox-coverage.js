const sandbox = require('@log4js-node/sandboxed-module');
// eslint-disable-next-line import/no-extraneous-dependencies
const NYC = require('nyc');

sandbox.configure({
  sourceTransformers: {
    nyc(source) {
      if (this.filename.indexOf('node_modules') > -1) {
        return source;
      }
      const nyc = new NYC({});
      return nyc.instrumenter().instrumentSync(source, this.filename, { sourceMap: undefined });
    },
  },
});
