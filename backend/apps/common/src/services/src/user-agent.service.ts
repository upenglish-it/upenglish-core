import * as UAParser from 'ua-parser-js';

export const SameUserAgent = (ua1: string, ua2: string): boolean => {
  try {
    const userAgentOne = new UAParser().setUA(ua1).getResult();
    const userAgentTwo = new UAParser().setUA(ua2).getResult();

    // Matched browser
    if (userAgentOne.browser.name !== userAgentOne.browser.name) {
      return false;
    }

    if (userAgentOne.engine.name !== userAgentOne.engine.name) {
      return false;
    }

    if (userAgentOne.os.name !== userAgentOne.os.name) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
};
