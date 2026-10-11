// react-native-css@3.0.7 reads its compiler options from the per-file transform options, but
// Metro only hands `transformer.reactNativeCSS` to the transformer config. Without forwarding,
// `inlineVariables.exclude` is ignored and native builds freeze the light :root palette.
module.exports.transform = (config, projectRoot, filePath, data, options) => {
  const { transform } = require(config.reactNativeCSSTransformerPath);
  const isCss = options.type !== "asset" && /\.(s?css|sass)$/.test(filePath);
  return transform(
    config,
    projectRoot,
    filePath,
    data,
    isCss ? { ...options, reactNativeCSS: config.reactNativeCSS } : options,
  );
};
