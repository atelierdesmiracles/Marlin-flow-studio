from pathlib import Path
p=Path('src/components/tools/BootscreenStudio.jsx')
s=p.read_text()
checks=[
 'function imageDraw', 'fitMode', 'offsetX', 'offsetY', 'brightness', 'contrast',
 'downloadBinary', 'downloadPreviewPng', "module === \"converter\"", 'CUSTOM_BOOTSCREEN_BMPWIDTH',
 'const bits = canvasToMono(canvasRef.current, width, height', 'dark pixels as ON'
]
for x in checks:
    assert x in s, f'missing: {x}'
assert 'monoHeader(canvasRef.current' not in s, 'monoHeader still receives canvas instead of bits'
print('CHECK-BOOTSCREEN-ENHANCED OK')
