Create Table Area(
	area_id int unsigned primary key auto_increment,
    program int unsigned not null,
    area_name varchar(50) not null,
    Foreign Key(program) References Program(program_id)
)