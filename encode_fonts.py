import base64
import os

font_dir = "public/fonts/Poppins/"

font_files = {
    "Poppins-Regular.ttf": "PoppinsRegularBase64",
    "Poppins-Bold.ttf": "PoppinsBoldBase64",
    "Poppins-SemiBold.ttf": "PoppinsSemiBoldBase64",
    "Poppins-ExtraBold.ttf": "PoppinsExtraBoldBase64",
    "Poppins-Medium.ttf": "PoppinsMediumBase64",
}

for filename, var_name in font_files.items():
    file_path = os.path.join(font_dir, filename)
    try:
        with open(file_path, "rb") as font_file:
            encoded_string = base64.b64encode(font_file.read()).decode('utf-8')
            print(f"// Copy this for {filename}")
            print(f"const {var_name} = 'data:application/x-font-ttf;base64,{encoded_string}';\n")
    except FileNotFoundError:
        print(f"Error: Font file not found at {file_path}. Please ensure it is in {font_dir}")
    except Exception as e:
        print(f"An error occurred with {filename}: {e}")