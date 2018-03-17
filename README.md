<p align="center">
  <a href="https://hub.docker.com/r/yboyer/rrr/">
    <img height="350" src="https://raw.githubusercontent.com/yboyer/realreleaseradar/master/.github/cover.jpg">
  </a>
  <p align="center"><i>Real Release Radar</i> Spotify's playlist</p>
</p>

> Creates and updates a Release Radar playlist on Spotify with **all** your new weekly tracks.

 - https://spotify.yoannboyer.com


## Usage
### Setup
1. Go to https://developer.spotify.com/my-applications/
2. Create an app
3. Get the client id and the client secret
4. Set your redirect url _(https://your.base.url/callback -> the `/callback` is important)_

```shell
docker run --name releaseradar \
  -e CLIENT_ID=$CLIENT_ID \
  -e CLIENT_SECRET=$CLIENT_SECRET \
  -e REDIRECT_URI=$REDIRECT_URI \
  -v $PWD/releaseradar_data/:/src/users/dbs \
  -p 3000:3000 \
  yboyer/rrr
```

### List of urls
 - `/login`: Subscribes to the Real Release Radar playlist
 - `/logout`: Unsubscribes from the service
 - `/toggle_appears_on`: Toggles the option to include the appearance of artists on other albums _(enabled by default)_

## License
MIT © [Yoann Boyer](http://yoannboyer.com)
