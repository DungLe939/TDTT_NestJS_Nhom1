from selenium import webdriver
from selenium.webdriver.edge.service import Service
from selenium.webdriver.edge.options import Options
from selenium.webdriver.common.by import By
from webdriver_manager.microsoft import EdgeChromiumDriverManager
import time
import re

def clean_name(text):
    text = re.sub(r'\d+', '', text)
    junk = ['mã giảm', 'yêu thích', 'đối tác', 'shopeefood', 'đặt chỗ', 'giao tận nơi']
    for j in junk:
        text = text.lower().replace(j, '')
    return text.strip().capitalize()

def crawl_shopeefood_edge():
    url = "https://shopeefood.vn/ho-chi-minh/danh-sach-dia-diem-giao-tan-noi"
    print("--- Dang khoi dong trinh duyet Edge ao ---")
    
    options = Options()
    # options.add_argument("--headless") # Chạy ẩn nếu bạn muốn nó không hiện cửa sổ lên
    
    # SỬ DỤNG EDGE (MÁY WINDOWS NÀO CŨNG CÓ)
    driver = webdriver.Edge(service=Service(EdgeChromiumDriverManager().install()), options=options)
    
    try:
        print(f"Dang truy cap: {url}")
        driver.get(url)
        
        print("Dang doi 7 giay cho trang web hien thi danh sach...")
        time.sleep(7) 
        
        # Tìm tất cả các quán/món ăn
        items = driver.find_elements(By.CLASS_NAME, "name-res")
        
        results = []
        for item in items:
            name = item.text.strip()
            cleaned = clean_name(name)
            if len(cleaned) > 5:
                print(f"Da tim thay: {cleaned}")
                results.append(cleaned)
        
        return results

    except Exception as e:
        print(f"Loi: {e}")
        return []
    finally:
        driver.quit()

if __name__ == "__main__":
    dishes = crawl_shopeefood_edge()
    
    with open("crawled_dishes.txt", "w", encoding="utf-8") as f:
        for d in dishes:
            f.write(d + "\n")
            
    print(f"\nTHANH CONG! Da lay duoc {len(dishes)} mon an tu ShopeeFood (Dung Edge).")
