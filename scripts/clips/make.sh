#!/bin/zsh
# Cut, encode (H.264, CRF 28, index first), and poster clips: ./make.sh goldenmesa-full okcid-hall ...
# A clip named <site>-<name> lands in assets/video/<site>/<name>.mp4.
S=${0:A:h}; R=/Users/chadeggar/Projects/michael-website
for clip in "$@"; do
  site=${clip%%-*}; name=${clip#*-}
  mkdir -p $R/assets/video/$site $R/assets/images/optimized/$site/clips
  (cd $S && node clips.js $clip) || exit 1
  /Applications/Blender.app/Contents/MacOS/Blender -b -P $S/encode.py -- $S/clips/$clip $R/assets/video/$site/$name.mp4 28 2>&1 | grep -i -E "error|Traceback" | head -2
  python3 -I $S/faststart.py $R/assets/video/$site/$name.mp4 > /dev/null
  (cd $R && node -e 'require("sharp")(process.argv[1]).resize({width:1824,withoutEnlargement:true}).webp({quality:72}).toFile(process.argv[2]).then(r=>console.log(process.argv[3], r.width+"x"+r.height))' $S/clips/$clip/0001.png assets/images/optimized/$site/clips/$name.webp $clip)
  rm -rf -- "$S/clips/$clip"
done
