import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      // implement node event listeners here
      // on("before:browser:launch", (browser, launchOptions) => {
      //   if (browser.name === "chrome") {
      //     // Replace the binary path with your custom Chrome
      //     launchOptions.browserPath = "/path/to/your/custom/chrome";
      //   }
      //   return launchOptions;
      // });
      // config.browser = {
      //   name: "chrome",
      //   channel: "canary",
      //   family: "chromium",
      //   displayName: "Chrome Canary",
      //   version: "139.0.7258.139",
      //   path: "/Users/hugo/Documents/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      //   majorVersion: 139,
      //   isHeaded: false,
      //   isHeadless: false,
      //   // CYPRESS_BROWSER_PATH="/Users/hugo/Documents/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npx cypress open --browser chrome
      // };
      on("before:browser:launch", (browser, launchOptions) => {
        console.log("browser.name????", browser.name);
        if (browser.name === "chrome") {
          // Add Chromium flags
          launchOptions.args.push(
            "--js-flags=--max-old-space-size=4096", // 4 GB V8 heap
            "--disable-dev-shm-usage", // Avoid /dev/shm size issues (Docker/Linux)
            "--disable-features=OutOfBlinkCors"
          );
        }
        return launchOptions;
      });
    },
    experimentalMemoryManagement: true,
    experimentalRunAllSpecs: true,
    // numTestsKeptInMemory: 10,
  },
});
