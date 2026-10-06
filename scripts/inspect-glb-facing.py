"""Local diagnostic: render textured GLB vertices from both Z directions."""
import io
import json
import struct
import sys
from PIL import Image, ImageDraw

data = open(sys.argv[1], 'rb').read()
json_length = struct.unpack_from('<I', data, 12)[0]
gltf = json.loads(data[20:20 + json_length])
binary_start = 20 + json_length + 8
primitive = gltf['meshes'][0]['primitives'][0]

def accessor(name):
    item = gltf['accessors'][primitive['attributes'][name]]
    view = gltf['bufferViews'][item['bufferView']]
    offset = binary_start + view.get('byteOffset', 0) + item.get('byteOffset', 0)
    width = {'VEC3': 3, 'VEC2': 2}[item['type']]
    return [struct.unpack_from('<' + 'f' * width, data, offset + index * width * 4)
            for index in range(item['count'])]

positions = accessor('POSITION')
uvs = accessor('TEXCOORD_0')
texture = gltf['textures'][gltf['materials'][0]['pbrMetallicRoughness']['baseColorTexture']['index']]
view = gltf['bufferViews'][gltf['images'][texture['source']]['bufferView']]
start = binary_start + view.get('byteOffset', 0)
paint = Image.open(io.BytesIO(data[start:start + view['byteLength']])).convert('RGB')
for sign, label in [(1, 'plus-x'), (-1, 'minus-x')]:
    image = Image.new('RGB', (420, 850), (28, 29, 31))
    draw = ImageDraw.Draw(image)
    indexed = sorted(zip(positions, uvs), key=lambda item: sign * item[0][0])
    for (x, y, z), (u, v) in indexed:
        px = round((z / .6 + .5) * 420)
        py = round((1 - y) * 800) + 25
        tx = max(0, min(paint.width - 1, round(u * (paint.width - 1))))
        ty = max(0, min(paint.height - 1, round((1-v) * (paint.height - 1))))
        color = paint.getpixel((tx, ty))
        draw.ellipse((px-2, py-2, px+2, py+2), fill=color)
    output = f'/private/tmp/tripo-{label}.png'
    image.save(output)
    print(output)
