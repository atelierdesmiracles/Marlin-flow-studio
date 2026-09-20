from pathlib import Path
p = Path(__file__).parent
src = p / 'src/components/tools/BootscreenStudio.jsx'
text = src.read_text(encoding='utf-8')
required = [
    'CUSTOM_BOOTSCREEN_BMPWIDTH',
    'CUSTOM_BOOTSCREEN_BMPHEIGHT',
    'CUSTOM_BOOTSCREEN_TIMEOUT',
    'custom_start_bmp',
    'RGB565',
    'SHOW_CUSTOM_BOOTSCREEN',
    'Bootscreen Studio',
]
missing = [x for x in required if x not in text]
assert not missing, missing
print('Bootscreen Studio static checks: OK')
