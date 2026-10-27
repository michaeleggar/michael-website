# Encodes a clip's frames to an H.264 MP4 with Blender's own FFmpeg, at the
# frames' own size.
# Run: blender -b -P encode.py -- <frames dir> <output.mp4> [crf]
import bpy, os, sys
args = sys.argv[sys.argv.index('--') + 1:]
src, dest = args[0], args[1]
crf = args[2] if len(args) > 2 else 'MEDIUM'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
files = sorted(f for f in os.listdir(src) if f.endswith('.png'))
scene.render.fps = 30
size = bpy.data.images.load(os.path.join(src, files[0])).size
scene.render.resolution_x, scene.render.resolution_y = size[0], size[1]
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'Standard'
scene.sequence_editor_create()
seq = scene.sequence_editor
strips = seq.strips if hasattr(seq, 'strips') else seq.sequences
strip = strips.new_image('Film', os.path.join(src, files[0]), channel=1, frame_start=1)
for f in files[1:]: strip.elements.append(f)
scene.frame_start, scene.frame_end = 1, len(files)
r = scene.render
if hasattr(r.image_settings, 'media_type'): r.image_settings.media_type = 'VIDEO'
r.image_settings.file_format = 'FFMPEG'
r.ffmpeg.format = 'MPEG4'
r.ffmpeg.codec = 'H264'
r.ffmpeg.constant_rate_factor = crf
r.ffmpeg.ffmpeg_preset = 'BEST'
r.ffmpeg.gopsize = 30
r.ffmpeg.audio_codec = 'NONE'
r.filepath = dest
r.use_file_extension = False
bpy.ops.render.render(animation=True)
