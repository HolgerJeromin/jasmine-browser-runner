function buildWebdriver(browserInfo, webdriverBuilder) {
  const webdriver = require('selenium-webdriver'),
    Capability = webdriver.Capability;

  webdriverBuilder = webdriverBuilder || new webdriver.Builder();
  const useRemote =
    typeof browserInfo === 'object' && browserInfo.useRemoteSeleniumGrid;
  let browserName;

  if (typeof browserInfo === 'string') {
    browserName = browserInfo;
  } else if (browserInfo) {
    browserName = browserInfo.name;
  }

  browserName = browserName || 'firefox';

  if (!useRemote) {
    if (browserName === 'headlessChrome') {
      const caps = webdriver.Capabilities.chrome();
      caps.set('goog:chromeOptions', {
        args: [
          '--headless=new',
          '--no-sandbox',
          'window-size=1024,768',
          '--disable-gpu',
          '--disable-dev-shm-usage', // flag needed to avoid issues within docker https://stackoverflow.com/questions/56218242/headless-chromium-on-docker-fails
        ],
      });
      return webdriverBuilder
        .forBrowser('chrome')
        .withCapabilities(caps)
        .build();
    } else if (browserName === 'headlessFirefox') {
      const caps = webdriver.Capabilities.firefox();
      caps.set('moz:firefoxOptions', {
        args: ['--headless', '--width=1024', '--height=768'],
      });
      return webdriverBuilder
        .forBrowser('firefox')
        .withCapabilities(caps)
        .build();
    } else {
      return webdriverBuilder.forBrowser(browserName).build();
    }
  }

  let url;
  let capabilities;
  if (useRemote) {
    const remote = browserInfo.remoteSeleniumGrid;
    if (remote) {
      url = remote.url;
      capabilities = {
        ...remote,
        [Capability.BROWSER_NAME]: browserName,
      };
      delete capabilities.url;
    }
  }

  if (!capabilities) {
    capabilities = {
      [Capability.BROWSER_NAME]: browserName,
    };
  }

  return webdriverBuilder
    .withCapabilities(capabilities)
    .usingServer(url || 'http://localhost:4445/wd/hub')
    .build();
}

module.exports = { buildWebdriver };
