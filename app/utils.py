import io
import qrcode
from PIL import Image, ImageDraw, ImageFont


def generate_product_number(shift, production_date, product_type, serial_no):
    """Generate a unique product number like A-230323-R-001."""
    shift_map = {'A': 'A', 'B': 'B', 'C': 'C', 'Day': 'A', 'Night': 'B'}
    shift_letter = shift_map.get(shift, shift[0].upper() if shift else 'A')

    date_str = production_date.strftime('%y%m%d')

    type_map = {
        'Roll': 'R',
        'Cut Piece': 'C',
        'Bag': 'B',
        'Sheet': 'S',
        'Fabric': 'F',
    }
    type_code = type_map.get(product_type, product_type[0].upper() if product_type else 'R')

    serial_str = str(serial_no).zfill(3)

    return f"{shift_letter}-{date_str}-{type_code}-{serial_str}"


def generate_qr_code(data, product_info=None):
    """Generate a QR code PNG image as bytes."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=10,
        border=4,
    )
    qr.add_data(data)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer.getvalue()


def generate_sticker_image(product):
    """Generate a sticker image with QR code and product details."""
    sticker_width = 600
    sticker_height = 400
    sticker = Image.new('RGB', (sticker_width, sticker_height), 'white')
    draw = ImageDraw.Draw(sticker)

    # Try to load a font, fall back to default
    try:
        title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
        label_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 14)
        value_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 14)
    except (IOError, OSError):
        title_font = ImageFont.load_default()
        label_font = ImageFont.load_default()
        value_font = ImageFont.load_default()

    # Draw border
    draw.rectangle([2, 2, sticker_width - 3, sticker_height - 3], outline='black', width=2)

    # Header
    draw.rectangle([2, 2, sticker_width - 3, 45], fill='#1a237e', outline='black')
    draw.text((sticker_width // 2, 12), "TEJASWI NONWOVENS", fill='white', font=title_font, anchor='mt')

    # Generate QR code
    qr_bytes = generate_qr_code(product.get('product_number', ''))
    qr_img = Image.open(io.BytesIO(qr_bytes))
    qr_img = qr_img.resize((160, 160))
    sticker.paste(qr_img, (410, 60))

    # Product details on the left side
    x_label = 20
    x_value = 160
    y_start = 65
    line_height = 28

    details = [
        ('Product No:', product.get('product_number', '')),
        ('Quality:', product.get('quality', '')),
        ('GSM:', str(product.get('gsm', ''))),
        ('Colour:', product.get('colour', '')),
        ('Type:', product.get('product_type', '')),
        ('Gross Wt:', f"{product.get('gross_weight', '')} kg"),
        ('Net Wt:', f"{product.get('net_weight', '')} kg"),
        ('Size:', f"{product.get('length', '')} x {product.get('width', '')}"),
        ('Date:', str(product.get('production_date', ''))),
        ('Machine:', product.get('machine', '')),
    ]

    for i, (label, value) in enumerate(details):
        y = y_start + i * line_height
        draw.text((x_label, y), label, fill='black', font=label_font)
        draw.text((x_value, y), str(value), fill='black', font=value_font)

    # Footer
    draw.line([(2, sticker_height - 35), (sticker_width - 3, sticker_height - 35)], fill='black', width=1)
    lam_text = "LAMINATED" if product.get('laminated') else "NON-LAMINATED"
    draw.text((sticker_width // 2, sticker_height - 25), lam_text, fill='#666666', font=label_font, anchor='mt')

    buffer = io.BytesIO()
    sticker.save(buffer, format='PNG')
    buffer.seek(0)
    return buffer.getvalue()
