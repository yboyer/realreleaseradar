import { createReleaseConfig } from '@yboyer/semantic-release-config'

export default {
  ...createReleaseConfig({ gitAssets: ['package.json'] }),
  branches: ['master', 'main'],
}
