-- Create the employee table
CREATE TABLE employee (
    empid INT PRIMARY KEY,
    ename VARCHAR(50),
    desg VARCHAR(50),
    deptid INT,
    sex VARCHAR(10),
    doj DATE,
    sal DECIMAL(10, 2)
);

-- Insert the data into the employee table
INSERT INTO employee (empid, ename, desg, deptid, sex, doj, sal) VALUES
(1, 'Radhika', 'Manager', 2, 'female', '1992-09-15', 33000.00),
(2, 'Raj', 'Manager', 1, 'male', '1992-07-15', 43000.00),
(3, 'Ram', 'Cashier', 1, 'male', '1982-09-30', 46000.00),
(4, 'Viswa', 'Manager', 1, 'male', '1996-11-25', 47000.00),
(5, 'Radhika', 'Accountant', 2, 'female', '2002-07-15', 32000.00),
(6, 'Khadir', 'Software developer', 3, 'male', '1989-06-05', 45000.00),
(7, 'Divya', 'Clerk', 4, 'female', '1985-06-25', 10000.00),
(8, 'Stella', 'Clerk', 1, 'female', '1993-06-25', 12000.00),
(9, 'Ramu', 'Clerk', 2, 'male', '1993-04-08', 13000.00),
(10, 'Dev', 'Accountant', 4, 'male', '1993-03-01', 32000.00);

select * from employee;

-- Create the department table
CREATE TABLE department (
    deptid INT PRIMARY KEY,
    dname VARCHAR(50),
    loc VARCHAR(50),
    asset DECIMAL(10, 2)
);

-- Insert the data into the department table
INSERT INTO department (deptid, dname, loc, asset) VALUES
(1, 'HRM', 'Chennai', 100000.00),
(2, 'Production', 'Kolkata', 150000.00),
(3, 'IT', 'Mumbai', 150000.00),
(4, 'Marketing', 'Chennai', 250000.00);

select * from department;


select e.ename, e.desg, d.dname, e.sal from employee e, department d where e.deptid = d.deptid and doj>'1994-11-25';

select ename, sal, desg, doj from employee where desg='Manager' order by doj asc;

select ename, desg, sal from employee where sal between 20000 and 40000;

select ename, desg, doj from employee where sex='male' and desg='Software developer';

select count(*) 'Female Manager(s)' from employee where sex='female' and desg='Manager';

select e.ename, e.desg, e.sal, d.dname from employee e, department d where e.deptid=d.deptid and loc='Chennai' order by doj asc;

select d.dname, count(*) 'Number of employees' from employee e, department d where e.deptid=d.deptid group by e.deptid;

select * from employee where ename like 'S%';

select min(sal), max(sal), avg(sal) from employee;

select asset, loc from department where dname='HRM' or dname='IT';






