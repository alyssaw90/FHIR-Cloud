﻿(function () {
    'use strict';

    var serviceId = 'conditionService';

    function conditionService($filter, $http, $timeout, common, dataCache, fhirClient, fhirServers, localValueSets) {
        var dataCacheKey = 'localConditions';
        var itemCacheKey = 'contextCondition';
        var logError = common.logger.getLogFn(serviceId, 'error');
        var logInfo = common.logger.getLogFn(serviceId, 'info');
        var $q = common.$q;

        function addCondition(resource) {
            _prepArrays(resource);
            var deferred = $q.defer();
            fhirServers.getActiveServer()
                .then(function (server) {
                    var url = server.baseUrl + "/Condition";
                    fhirClient.addResource(url, resource)
                        .then(function (results) {
                            deferred.resolve(results);
                        }, function (outcome) {
                            deferred.reject(outcome);
                        });
                });
            return deferred.promise;
        }

        function clearCache() {
            dataCache.addToCache(dataCacheKey, null);
        }

        function deleteCachedCondition(hashKey, resourceId) {
            function removeFromCache(searchResults) {
                if (searchResults && searchResults.entry) {
                    var cachedConditions = searchResults.entry;
                    searchResults.entry = _.remove(cachedConditions, function (item) {
                        return item.$$hashKey !== hashKey;
                    });
                    searchResults.totalResults = (searchResults.totalResults - 1);
                    dataCache.addToCache(dataCacheKey, searchResults);
                }
                deferred.resolve();
            }

            var deferred = $q.defer();
            deleteCondition(resourceId)
                .then(getCachedSearchResults,
                function (error) {
                    deferred.reject(error);
                })
                .then(removeFromCache,
                function (error) {
                    deferred.reject(error);
                })
                .then(function () {
                    deferred.resolve();
                });
            return deferred.promise;
        }

        function deleteCondition(resourceId) {
            var deferred = $q.defer();
            fhirClient.deleteResource(resourceId)
                .then(function (results) {
                    deferred.resolve(results);
                }, function (outcome) {
                    deferred.reject(outcome);
                });
            return deferred.promise;
        }

        function getCachedCondition(hashKey) {
            function getCondition(searchResults) {
                var cachedCondition;
                var cachedConditions = searchResults.entry;
                for (var i = 0, len = cachedConditions.length; i < len; i++) {
                    if (cachedConditions[i].$$hashKey === hashKey) {
                        cachedCondition = cachedConditions[i].resource;
                        var baseUrl = (searchResults.base || (activeServer.baseUrl + '/'));
                        cachedCondition.resourceId = (baseUrl + cachedCondition.resourceType + '/' + cachedCondition.id);
                        cachedCondition.hashKey = hashKey;
                        break;
                    }
                }
                if (cachedCondition) {
                    deferred.resolve(cachedCondition);
                } else {
                    deferred.reject('Condition not found in cache: ' + hashKey);
                }
            }

            var deferred = $q.defer();
            var activeServer;
            getCachedSearchResults()
                .then(fhirServers.getActiveServer()
                    .then(function (server) {
                        activeServer = server;
                    }))
                .then(getCondition,
                function () {
                    deferred.reject('Condition search results not found in cache.');
                });
            return deferred.promise;
        }

        function getCachedSearchResults() {
            var deferred = $q.defer();
            var cachedSearchResults = dataCache.readFromCache(dataCacheKey);
            if (cachedSearchResults) {
                deferred.resolve(cachedSearchResults);
            } else {
                deferred.reject('Search results not cached.');
            }
            return deferred.promise;
        }

        function getCondition(resourceId) {
            var deferred = $q.defer();
            fhirClient.getResource(resourceId)
                .then(function (data) {
                    dataCache.addToCache(dataCacheKey, data);
                    deferred.resolve(data);
                }, function (outcome) {
                    deferred.reject(outcome);
                });
            return deferred.promise;
        }

        function getConditionContext() {
            return dataCache.readFromCache(dataCacheKey);
        }

        function getConditionReference(baseUrl, input) {
            var deferred = $q.defer();
            fhirClient.getResource(baseUrl + '/Condition?name=' + input + '&_count=20')
                .then(function (results) {
                    var familyHistories = [];
                    if (results.data.entry) {
                        angular.forEach(results.data.entry,
                            function (item) {
                                if (item.content && item.content.resourceType === 'Condition') {
                                    familyHistories.push({
                                        display: $filter('fullName')(item.content.name),
                                        reference: item.id
                                    });
                                }
                            });
                    }
                    if (familyHistories.length === 0) {
                        familyHistories.push({display: "No matches", reference: ''});
                    }
                    deferred.resolve(familyHistories);
                }, function (outcome) {
                    deferred.reject(outcome);
                });
            return deferred.promise;
        }

        function searchConditions(baseUrl, searchFilter) {
            var deferred = $q.defer();

            if (angular.isUndefined(searchFilter) && angular.isUndefined(organizationId)) {
                deferred.reject('Invalid search input');
            }
            fhirClient.getResource(baseUrl + '/Condition?' + searchFilter + '&_count=20')
                .then(function (results) {
                    dataCache.addToCache(dataCacheKey, results.data);
                    deferred.resolve(results.data);
                }, function (outcome) {
                    deferred.reject(outcome);
                });
            return deferred.promise;
        }

        function getConditions(baseUrl, searchFilter, patientId) {
            var deferred = $q.defer();
            var params = '';

            if (angular.isUndefined(searchFilter) && angular.isUndefined(patientId)) {
                deferred.reject('Invalid search input');
            }


            if (angular.isDefined(patientId)) {
                var patientParam = 'patient=' + patientId;
                if (params.length > 1) {
                    params = params + '&' + patientParam;
                } else {
                    params = patientParam;
                }
            }

            fhirClient.getResource(baseUrl + '/Condition?' + params + '&_count=20')
                .then(function (results) {
                    dataCache.addToCache(dataCacheKey, results.data);
                    deferred.resolve(results.data);
                }, function (outcome) {
                    deferred.reject(outcome);
                });
            return deferred.promise;
        }

        function getConditionsByLink(url) {
            var deferred = $q.defer();
            fhirClient.getResource(url)
                .then(function (results) {
                    dataCache.addToCache(dataCacheKey, results.data);
                    deferred.resolve(results.data);
                }, function (outcome) {
                    deferred.reject(outcome);
                });
            return deferred.promise;
        }

        function initializeNewCondition() {
            return {
                "resourceType": "Condition",
                "identifier": [],
                "patient": null

            };
        }

        function setConditionContext(data) {
            dataCache.addToCache(itemCacheKey, data);
        }

        function updateCondition(resourceVersionId, resource) {
            _prepArrays(resource);
            var deferred = $q.defer();
            fhirClient.updateResource(resourceVersionId, resource)
                .then(function (results) {
                    deferred.resolve(results);
                }, function (outcome) {
                    deferred.reject(outcome);
                });
            return deferred.promise;
        }

        function seedRandomConditions(patientId, practitionerId) {

        }

        function _prepArrays(resource) {

            if (resource.identifier.length === 0) {
                resource.identifier = null;
            }
            return $q.when(resource);
        }

        var service = {
            addCondition: addCondition,
            clearCache: clearCache,
            deleteCachedCondition: deleteCachedCondition,
            deleteCondition: deleteCondition,
            getCachedCondition: getCachedCondition,
            getCachedSearchResults: getCachedSearchResults,
            getCondition: getCondition,
            getConditionContext: getConditionContext,
            getConditionReference: getConditionReference,
            getConditions: getConditions,
            getConditionsByLink: getConditionsByLink,
            initializeNewCondition: initializeNewCondition,
            setConditionContext: setConditionContext,
            updateCondition: updateCondition,
            seedRandomConditions: seedRandomConditions,
            searchConditions: searchConditions
        };

        return service;
    }

    angular.module('FHIRCloud').factory(serviceId, ['$filter', '$http', '$timeout', 'common', 'dataCache', 'fhirClient', 'fhirServers', 'localValueSets',
        conditionService]);
})
();