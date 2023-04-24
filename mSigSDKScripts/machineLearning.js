import * as MLR from "https://cdn.jsdelivr.net/npm/ml-regression-multivariate-linear/+esm";

import * as CV from "https://cdn.jsdelivr.net/npm/ml-cross-validation/+esm";

import { groupBy } from "./utils.js";

/**
 * Preprocesses mutational and exposure data for a given data source.
 * Currently only supports data from MSigDB portal.
 * @param {Array} mutationalData - Array of mutational data.
 * @param {Array} exposureData - Array of exposure data.
 * @param {string} dataSource - Data source identifier.
 * @returns {Object} - Object containing input (Xs) and output (Ys) arrays for regression.
 * @throws {Error} - If an unknown data source is provided.
 */

export function preprocessData(mutationalData, exposureData, dataSource) {
  switch (dataSource.toUpperCase()) {
    case "MSIGPORTAL":
      return preprocessMSIGPORTALExposureData(mutationalData, exposureData);
    case "ICGC":
      return null;
    default:
      throw new Error("Unknown data source: " + dataSource);
  }
}

function intersectByKeys(dict1, dict2) {
  const intersection = {};
  for (const key in dict1) {
    if (key in dict2) {
      intersection[key] = [dict1[key].map(data =>data["mutations"]), dict2[key].map(data =>data["exposure"])];
    }
  }
  return intersection;
}

function preprocessMSIGPORTALExposureData(mutationalData, exposureData) {
  // Group the data by the column "sampleName"
  const groupedMutationalData = groupBy(mutationalData, "sample");
  const groupedExposureData = groupBy(exposureData, "sample");

  const intersectedData = intersectByKeys(
    groupedMutationalData,
    groupedExposureData
  );

    // Separate the intersected data into Xs and Ys
    const Xs = [];
    const Ys = [];
    for (const key in intersectedData) {

      // Check if the length of the Xs is 96 (i.e. the number of mutational signatures) and the length of the Ys is 65 (i.e. the number of mutational exposures)

      if (intersectedData[key][0].length !== intersectedData[Object.keys(intersectedData)[0]][0].length || intersectedData[key][1].length !== intersectedData[Object.keys(intersectedData)[0]][1].length) {
        continue;
      }else{
        Xs.push(intersectedData[key][0]);
        Ys.push(intersectedData[key][1]);
      }
        }
    return { Xs, Ys };  
}

/**
 * Performs k-fold stratified cross-validation for multivariate linear or MLP regression models.
 * @param {Array} Xs - Array of input data.
 * @param {Array} Ys - Array of output data.
 * @param {number} [k=10] - Number of folds for cross-validation.
 * @param {string} [modelType="MLR"] - Regression model type ("MLR" for multivariate linear regression or "MLP" for multilayer perceptron).
 * @returns {Object} - Object containing an array of trained regression models, an array of mean squared errors for each fold, and the average mean squared error across all folds.
 * @throws {Error} - If an unknown model type is provided.
 */
export function kFoldStratifiedCV(Xs, Ys, k = 10, modelType = "MLR") {
  
    // Prepare the dataset for stratified k-fold cross-validation
    const dataset = [];
    for (let i = 0; i < Xs.length; i++) {
      dataset.push({
        input: Xs[i],
        output: Ys[i],
      });
    }
  
    // Create a stratified k-fold cross-validator
    const crossValidator = CV.getFolds(dataset, k);
  
    // Initialize variables to store performance metrics
    let totalMSE = 0;
  
    const models = [];
    const mses = [];
    // Perform stratified k-fold cross-validation
    crossValidator.forEach((crossFold) => {
      // Prepare the training data

      const X_train = crossFold.trainIndex.map(index => Xs[index])

      const Y_train = crossFold.trainIndex.map(index => Ys[index])
  
      // Prepare the testing data
      const X_test = crossFold.testIndex.map(index => Xs[index])
      const Y_test = crossFold.testIndex.map(index => Ys[index])
  
      // Train the multivariate linear regression model
      let regression;


      switch (modelType.toUpperCase()) {
        case "MLR":
            regression = new MLR.default(X_train, Y_train);
            models.push(regression);
            break;
        case "MLP":
            regression = new MLP.default(X_train, Y_train);
            models.push(regression);
            break;
        default:
            throw new Error("Unknown model type: " + modelType);
        }

  
      // Test the model and calculate the mean squared error
      let mse = 0;
      for (let i = 0; i < X_test.length; i++) {
        const prediction = regression.predict(X_test[i]);
        mse += meanSquaredError(prediction, Y_test[i]);
      }
      mse /= X_test.length;
      mses.push(mse);
      // Accumulate the mean squared error
      totalMSE += mse;
    });
  
    // Calculate the average mean squared error
    const averageMSE = totalMSE / k;
  
    // Return the average mean squared error
    return {'model': models, 'MSE':mses, 'averageMSE':averageMSE};
  }
  
  function meanSquaredError(prediction, actual) {
    let mse = 0;
    for (let i = 0; i < prediction.length; i++) {
      mse += Math.pow(prediction[i] - actual[i], 2);
    }
    return mse;
  }
  