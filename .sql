USE justscan
DROP TABLE IF EXISTS wordbooks;
DROP TABLE IF EXISTS word_cards;

CREATE TABLE wordbooks (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(64) UNIQUE NOT NULL,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE word_cards (
    id INT PRIMARY KEY AUTO_INCREMENT,
    word VARCHAR(64) NOT NULL,
    word_meaning TEXT,
    word_audio_url TEXT,
    example TEXT,
    example_meaning TEXT,
    example_audio_url TEXT,
    wordbook_id INT NOT NULL,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_deleted BOOLEAN DEFAULT FALSE,
    modify_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (wordbook_id) REFERENCES wordbooks(id)
);