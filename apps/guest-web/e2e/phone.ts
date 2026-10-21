import type { Browser, TestInfo } from "@playwright/test";

/** Otro comensal con su propio teléfono: contexto aparte (su cookie) con las opciones del proyecto. */
export async function phone(browser: Browser, testInfo: TestInfo, name: string) {
  const { baseURL, ignoreHTTPSErrors, locale, viewport, userAgent, isMobile, hasTouch } =
    testInfo.project.use;
  const context = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors,
    locale,
    viewport,
    userAgent,
    isMobile,
    hasTouch,
    recordVideo: { dir: testInfo.outputPath(`video-${name}`) },
  });
  const page = await context.newPage();
  return {
    page,
    close: async () => {
      const video = page.video();
      await context.close();
      if (video) await testInfo.attach(`video de ${name}`, { path: await video.path() });
    },
  };
}
