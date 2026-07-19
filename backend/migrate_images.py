import os
from dotenv import load_dotenv

load_dotenv()

import cloudinary
import cloudinary.uploader


def upload_images():
    base_dir = "static"
    url_map = {}
    for root, dirs, files in os.walk(base_dir):
        for file in files:
            if file.endswith(('.jpg', '.png', '.jpeg')):
                filepath = os.path.join(root, file)
                # the "public_id" will be the relative path without extension to keep it organized
                # e.g., Accessory/1
                rel_path = os.path.relpath(filepath, base_dir)
                public_id = f"meesho_mock/{os.path.splitext(rel_path)[0].replace(os.sep, '/')}"
                
                print(f"Uploading {filepath}...")
                try:
                    result = cloudinary.uploader.upload(filepath, public_id=public_id)
                    secure_url = result.get('secure_url')
                    # Keep mapping format for database.py (e.g., /static/Accessory/1.jpg)
                    key = f"/{base_dir}/{rel_path.replace(os.sep, '/')}"
                    url_map[key] = secure_url
                    print(f"Success: {secure_url}")
                except Exception as e:
                    print(f"Failed to upload {filepath}: {e}")
                    
    print("\n\n=== URL MAPPING ===")
    print("MAPPING =", url_map)

if __name__ == "__main__":
    upload_images()
