const { pool } = require("../../config/database");
const { AWS } = require('../../config/dynamo');

async function getUserIndex(userID) {
    const connection = await pool.getConnection(async (conn) => conn);
    const getUserIndexQuery = `SELECT userIndex FROM User WHERE userID = '${userID}';`;
    const [rows] = await connection.query(getUserIndexQuery);
    connection.release();
    return rows;
}

async function getParkingList() {
    const connection = await pool.getConnection(async (conn) => conn);
    const getParkingListQuery = `SELECT parkingLotIndex, complexName FROM ParkingLot;`;
    const [rows] = await connection.query(getParkingListQuery);
    connection.release();
    return rows
}

 async function getComplexName(idx) {
    const connection = await pool.getConnection(async (conn) => conn);
    const getComplexNameQuery = `
    SELECT complexName FROM ParkingLot WHERE parkingLotIndex = ${idx};
    `;
    const [rows] = await connection.query(getComplexNameQuery);
    connection.release();
    return rows;
}

async function getFloors(idx) {
    const connection = await pool.getConnection(async (conn) => conn);
    const Query = `
    SELECT DISTINCT floor FROM ParkingArea WHERE parkingLotIndex = ${idx};
    `;
    const [rows] = await connection.query(Query);
    connection.release();
    return rows;
}

 async function getAreas(idx, floorName) {
    const connection = await pool.getConnection(async (conn) => conn);
    const Query = `
    SELECT areaName, areaInfo FROM ParkingArea WHERE parkingLotIndex = ? AND floor = ?;
    `;
    const Params = [idx, floorName];
    const [rows] = await connection.query(Query, Params);
    connection.release();
    return rows;
}

async function getCurrParkData(areaNumber) {

    // idx = 주차장 인덱스
    // RDS => 해당 주차장의 주차구역 & 정보(장애인전용/전기차전용/일반전용) 확인
    // DynamoDB => 해당 주차장의 특정 주차구역의 가장 최신 정보(차정보/inOut 등) 확인
    // 주차된 위치 표시 & 주차 위반 여부 팝업

    const dynamo = new AWS.DynamoDB.DocumentClient();

    const params = {
        TableName: "parking",
        ProjectionExpression: "#areaNumber, createdTime, carNum, disabled, electric, #inOut",
        KeyConditionExpression: "#areaNumber = :num",
        ExpressionAttributeNames:{
            "#areaNumber": "areaNumber",
            "#inOut": "inOut"
        },
        ExpressionAttributeValues: {
            ":num": areaNumber
        },
        ScanIndexForward: false,
        Limit: 1
    }

    const data = await dynamo.query(params).promise();

    return data.Items;
}

async function getMyCars(idx, userIndex) {
    const connection = await pool.getConnection(async (conn) => conn);
    const Query = `SELECT carNum AS cars FROM Car WHERE userIndex = ${userIndex};`;
    const [rows] = await connection.query(Query);
    connection.release();
    return rows;
}

async function getMyAreas(carNum) {
    const dynamo = new AWS.DynamoDB.DocumentClient();
    const params = {
        TableName: "parking",
        ProjectionExpression: "#areaNumber, createdTime, #carNum, disabled, electric, #inOut",
        FilterExpression: "#carNum = :carNum",
        ExpressionAttributeNames:{
            "#areaNumber": "areaNumber",
            "#inOut": "inOut",
            "#carNum": "carNum"
        },
        ExpressionAttributeValues: {
            ":carNum": carNum,
        },
        ScanIndexForward: false,
    }
    const data = await dynamo.scan(params).promise();
    return data.Items;
}

async function addToDynamo(parkLocation, createdTime, electric, carNum, disabled, inOut, credit, imgURL) {
    // credit 값 thershold 이상일 시 DynamoDB에 데이터 삽입
    const dynamo = new AWS.DynamoDB.DocumentClient();
    const params = {
        TableName: "parking",
        Item: {
            areaNumber: parkLocation,
            createdTime: createdTime,
            electric: electric,
            carNum: carNum,
            disabled: disabled,
            inOut: inOut
        }
    };
    const data = await dynamo.put(params).promise();
    console.log('등록될 data >>', data);
    return;
}

async function getUserList(userID, userPW) {
    const connection = await pool.getConnection(async (conn)=> conn);
    const [idRows, idFields] = await connection.query(`SELECT userID FROM User WHERE userID = ? `, [userID]);
    if (idRows.length > 0) {
        var [pwRows, pwFields] = await connection.query(`SELECT userID, userPW FROM User WHERE userID = ? AND userPW = ?`, [userID, userPW]);
        var userName = JSON.parse(JSON.stringify(idRows))[0].userID;
        var [indexRows, indexFields] = await connection.query(`SELECT userIndex, status FROM User WHERE userID = ?`, userName);
        var userIndex = JSON.parse(JSON.stringify(indexRows))[0].userIndex;
        var status = JSON.parse(JSON.stringify(indexRows))[0].status;
    }
    else {
        userName = [];
        userIndex = [];
        pwRows = [];
    }
    connection.release();
    return [userName,pwRows, userIndex, status];
} 

module.exports = {
    getUserIndex,
    getParkingList,
    getComplexName,
    getFloors,
    getAreas,
    getCurrParkData,
    getMyCars,
    getMyAreas,
    addToDynamo,
    getUserList
};