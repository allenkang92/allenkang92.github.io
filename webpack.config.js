const path = require('path');

module.exports = {
  entry: {
    main: './assets/js/index.js',
    calculators: './assets/js/calculators/index.js',
    posts: './assets/js/posts/index.js'
  },
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, 'assets', 'js', 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /node_modules/,
        use: ['babel-loader'],
      },
    ],
  },
  resolve: {
    extensions: ['.js', '.jsx'],
    alias: {
      '@': path.resolve(__dirname, 'assets/js'),  // '@' 별칭을 assets/js로 설정
    },
  },
};
