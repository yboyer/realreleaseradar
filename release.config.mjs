// biome-ignore lint/correctness/noUndeclaredDependencies: The release job installs this package through npx.
import { createReleaseConfig } from '@yboyer/semantic-release-config'

export default {
  ...createReleaseConfig({ gitAssets: ['package.json'] }),
}
