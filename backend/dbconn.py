import pymysql

# 建立连接
connection = pymysql.connect(
    host='127.0.0.1',
    port=3306,
    user='root',
    password='12345678',
    database='justscan',
    charset='utf8mb4'
)

try:
    with connection.cursor() as cursor:
        sql = "SELECT VERSION();"
        cursor.execute(sql)
        result = cursor.fetchone()
        print("数据库版本：", result)
finally:
    connection.close()