# 미완성 코드.
import os
from datetime import datetime

# 포스트 기본 정보 입력 받기
def get_post_info():
    title = input("포스트 제목을 입력하세요: ")
    category = input("카테고리를 입력하세요: ")
    tags = input("태그를 쉼표로 구분하여 입력하세요: ")
    content = input("포스트 내용을 입력하세요: ")
    
    # 날짜는 현재 날짜로 자동 생성
    date = datetime.now().strftime("%Y-%m-%d %H:%M:%S +0900")
    filename_date = datetime.now().strftime("%Y-%m-%d")
    
    # 마크다운 파일 이름은 YYYY-MM-DD-제목.md 형식
    filename = f"{filename_date}-{title.replace(' ', '-').lower()}.md"
    
    return title, category, tags, content, date, filename

# 마크다운 형식으로 포스트 파일 생성
def create_post_file(title, category, tags, content, date, filename):
    # Jekyll 포스트의 YAML front matter
    front_matter = f"""---
layout: post
title: "{title}"
date: {date}
categories: [{category}]
tags: [{tags}]
---

"""
    # 파일 경로 설정 (여기서 _posts 폴더를 지정)
    filepath = os.path.join("_posts", filename)

    # 파일 생성 및 내용 작성
    with open(filepath, 'w', encoding='utf-8') as file:
        file.write(front_matter)
        file.write(content)

    print(f"포스트 파일이 생성되었습니다: {filepath}")

# 메인 함수
if __name__ == "__main__":
    # _posts 폴더가 없으면 생성
    if not os.path.exists("_posts"):
        os.makedirs("_posts")
    
    title, category, tags, content, date, filename = get_post_info()
    create_post_file(title, category, tags, content, date, filename)
