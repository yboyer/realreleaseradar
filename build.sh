version=`node -p "require('./package.json').version"`
git push
git push --tags
docker buildx build --platform linux/amd64 -t yboyer/rrr:v$version -t yboyer/rrr:latest .
docker push yboyer/rrr:v$version
docker push yboyer/rrr:latest
