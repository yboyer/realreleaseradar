# RealReleaseRadar
> Creates and updates a Release Radar playlist on Spotify with **all** the new weekly tracks.

---
**WIP***

---

## Usage
```shell
docker run --name releaseradar \
  -e CLIENT_ID=$CLIENT_ID \
  -e CLIENT_SECRET=$CLIENT_SECRET \
  -e REDIRECT_URI=$REDIRECT_URI \
  -p 3000:3000 \
  yboyer/rrr

# then go to http://your.url/login
```

## License
MIT © [Yoann Boyer](yoannboyer.com)
