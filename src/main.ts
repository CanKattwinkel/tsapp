/// <reference path="../typings/angularjs/angular"/>

import customer = require("./Customer");

angular.module("app", [])
    .service("myService", customer.MyService)
    .controller("MyController", customer.MyController);

console.log("3");
console.log("3");
console.log("3");
console.log("3");