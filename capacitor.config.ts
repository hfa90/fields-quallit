import type { CapacitorConfig } from '@capacitor/cli'

/**
 * App Android da central Fields (Quallit).
 * O app abre o próprio site publicado: toda atualização do site chega no app na hora,
 * sem reinstalar. O service worker do site mantém o app e os tutoriais salvos funcionando offline.
 * O site continua funcionando normalmente no navegador.
 */
const SITE = 'https://hfa90.github.io/fields-quallit/'

const config: CapacitorConfig = {
  appId: 'br.com.quallit.fields',
  appName: 'Fields',
  webDir: 'android-shell',
  server: {
    url: SITE,
    errorPath: 'offline.html',
    // tudo que não for o site (downloads de anexos, links externos) abre no navegador do celular
    allowNavigation: ['hfa90.github.io'],
  },
  android: {
    backgroundColor: '#f5f5f7',
    allowMixedContent: false,
    captureInput: true,
    appendUserAgent: 'FieldsApp/Android',
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1200, launchAutoHide: true, backgroundColor: '#1A9CA9', showSpinner: false, androidScaleType: 'CENTER_CROP' },
    SystemBars: { insetsHandling: 'css', initialViewportFitValueHint: 'cover', style: 'LIGHT' },
  },
}

export default config
