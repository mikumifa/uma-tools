CREATE TABLE Employee (
    employeeId INT NOT NULL,
    name VARCHAR(50) NOT NULL,
    tel CHAR(11),
    departId INT,
    PRIMARY KEY (employeeId, name),
    FOREIGN KEY (departId) REFERENCES Department(departId)
);
CREATE TABLE `Order` (
    orderId INT NOT NULL,
    contractNo INT NOT NULL,
    data DATE,
    departId INT,
    clientId INT,
    PRIMARY KEY (orderId),
    FOREIGN KEY (departId) REFERENCES Department(departId),
    FOREIGN KEY (clientId) REFERENCES Client(clientId)
);
