Create Table User(
	user_id int unsigned primary key auto_increment,
    first_name varchar(15) not null,
    middle_name varchar(15),
    last_name varchar(15) not null,
    address varchar(255) not null,
    email varchar(30) not null,
    password text not null,
    user_level enum('1', '2', '3') not null,
    dob date not null
);