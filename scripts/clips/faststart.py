# Moves an MP4's index (the moov atom) ahead of its media data, in place, so a
# browser can start playing from the first bytes instead of fetching the end
# of the file first. Blender's FFmpeg writes it last and has no option for it.
# Usage: python3 faststart.py file.mp4 ...
import struct
import sys


def atoms(data, start, end):
    i = start
    while i + 8 <= end:
        size, kind = struct.unpack('>I4s', data[i:i + 8])
        header = 8
        if size == 1:
            size = struct.unpack('>Q', data[i + 8:i + 16])[0]
            header = 16
        elif size == 0:
            size = end - i
        if size < header:
            raise ValueError(f'bad atom at {i}')
        yield kind, i, size, header
        i += size


# Containers whose children can hold chunk-offset tables.
CONTAINERS = {b'moov', b'trak', b'mdia', b'minf', b'stbl', b'edts', b'udta'}


def shift_offsets(moov, start, end, delta):
    for kind, i, size, header in atoms(moov, start, end):
        body = i + header
        if kind in CONTAINERS:
            shift_offsets(moov, body, i + size, delta)
        elif kind == b'stco':
            count = struct.unpack('>I', moov[body + 4:body + 8])[0]
            for k in range(count):
                o = body + 8 + 4 * k
                moov[o:o + 4] = struct.pack('>I', struct.unpack('>I', moov[o:o + 4])[0] + delta)
        elif kind == b'co64':
            count = struct.unpack('>I', moov[body + 4:body + 8])[0]
            for k in range(count):
                o = body + 8 + 8 * k
                moov[o:o + 8] = struct.pack('>Q', struct.unpack('>Q', moov[o:o + 8])[0] + delta)


def faststart(path):
    data = open(path, 'rb').read()
    top = list(atoms(data, 0, len(data)))
    kinds = [k for k, *_ in top]
    if b'moov' not in kinds or b'mdat' not in kinds:
        raise ValueError(f'{path}: no moov or mdat')
    if kinds.index(b'moov') < kinds.index(b'mdat'):
        return False
    _, mi, msize, _ = top[kinds.index(b'moov')]
    moov = bytearray(data[mi:mi + msize])
    # Everything before the first non-ftyp atom stays first; moov goes right after.
    insert_at = next(i for k, i, *_ in top if k not in (b'ftyp',))
    # Media data moves later by the size of moov.
    shift_offsets(moov, 8, msize, msize)
    rest = data[insert_at:mi] + data[mi + msize:]
    with open(path, 'wb') as f:
        f.write(data[:insert_at] + moov + rest)
    return True


if __name__ == '__main__':
    for path in sys.argv[1:]:
        print(('moved ' if faststart(path) else 'already ') + path)
