Create Table User(
	user_id int unsigned primary key auto_increment,
    first_name varchar(15) not null,
    middle_name varchar(15),
    last_name varchar(15) not null,
    address varchar(255) not null,
    email varchar(30) not null,
    password text not null,
    user_level enum('level1', 'level2', 'level3') not null,
    dob_day int unsigned not null,
    dob_month int unsigned not null,
    dob_year int not null,
    constraint check_dob_day check (dob_day between 1 and 31),
    constraint check_dob_month check (dob_month between 1 and 12)
);