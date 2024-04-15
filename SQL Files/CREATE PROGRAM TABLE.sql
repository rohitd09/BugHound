CREATE TABLE Program(
	program_id int unsigned primary key auto_increment,
    program_name varchar(50) not null,
    program_category varchar(50) not null,
    program_version varchar(3) not null,
    program_summary varchar(255) not null
)