module.exports = {
  overrides: [
    {
      files: "*.sol",
      options: {
        bracketSpacing: false,
        printWidth: 130,
        tabWidth: 4,
        useTabs: false,
        singleQuote: false,
        explicitTypes: "always",
      },
    },
    {
      files: "*.js",
      options: {
        printWidth: 130,
        semi: false,
        trailingComma: "all",
      },
    },
  ],
}
