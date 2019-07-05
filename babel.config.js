const config = {
    presets: [
        "@babel/typescript",
        ["@babel/env", {
            targets: {
                node: "10"
            },
            modules: "commonjs",
        }],
    ],
};

module.exports = config;