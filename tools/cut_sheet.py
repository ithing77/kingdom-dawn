# GPT 그림 모음(흰 여백으로 나뉜 격자)을 칸별로 잘라 저장한다.
# 사용: python -I tools/cut_sheet.py 원본.png 열수 행수 이름1,이름2,... 출력폴더 [가로폭]
import sys
from PIL import Image

src, cols, rows, names, out = sys.argv[1], int(sys.argv[2]), int(sys.argv[3]), sys.argv[4].split(','), sys.argv[5]
width = int(sys.argv[6]) if len(sys.argv) > 6 else 360
im = Image.open(src).convert('RGB')
W, H = im.size
px = im.load()

def white(x, y):
    r, g, b = px[x, y]
    return r > 235 and g > 235 and b > 235

def bands(n, length, is_gap):
    # 그림이 있는 구간(여백이 아닌 줄)을 찾아서 n개로 묶는다
    filled = [not is_gap(i) for i in range(length)]
    segs, start = [], None
    for i, f in enumerate(filled + [False]):
        if f and start is None: start = i
        if not f and start is not None:
            if i - start > length // (n * 4): segs.append((start, i))
            start = None
    return segs

col_gap = lambda x: sum(white(x, y) for y in range(0, H, 4)) > (H // 4) * 0.9
row_gap = lambda y: sum(white(x, y) for x in range(0, W, 4)) > (W // 4) * 0.9
cs, rs = bands(cols, W, col_gap), bands(rows, H, row_gap)
print('열', cs, '행', rs)
assert len(cs) == cols and len(rs) == rows, '격자를 못 찾음'
k = 0
for (y0, y1) in rs:
    for (x0, x1) in cs:
        if k < len(names) and names[k]:
            piece = im.crop((x0 + 3, y0 + 3, x1 - 3, y1 - 3))
            piece = piece.resize((width, round(width * piece.height / piece.width)), Image.LANCZOS)
            piece.save(f'{out}/{names[k]}.jpg', quality=85)
        k += 1
