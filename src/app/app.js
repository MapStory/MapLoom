(function() {
  var module = angular.module('MapLoom', [
    'templates-app',
    'templates-common',
    'storytools.edit.style',
    'loom',
    'colorpicker.module',
    'ui.bootstrap',
    'ui.router',
    'ui.tree',
    'pascalprecht.translate',
    'loom_translations_en',
    'loom_translations_es',
    'xeditable'
  ]);

  module.config(['$locationProvider', function($locationProvider) {
    $locationProvider.html5Mode(true);
  }]);

  module.run(function run(editableOptions) {
    editableOptions.theme = 'bs3';
  });

  module.controller('AppCtrl', function AppCtrl($rootScope, $scope, $window, $location, $translate, mapService, debugService,
                                                refreshService, dialogService, historyService, storyService, boxService, pinService, $http, layerService, serverService) {

        var setActiveChapter = function(chapter_index) {
          $scope.activeChapterId = chapter_index;
          $window.config.chapter_index = chapter_index;
        };

        setActiveChapter(0);

        $scope.$on('$stateChangeSuccess', function(event, toState) {
          if (angular.isDefined(toState.data.pageTitle)) {
            $scope.pageTitle = toState.data.pageTitle;
          }
        });

        $scope.$on('layer-added', function(event) {
          if (goog.isDefAndNotNull($scope.mapService)) {
            $scope.storyLayers = $scope.mapService.getStoryLayers(true, true);
            if ($scope.storyLayers.length > 0 && goog.isDefAndNotNull($scope.layerName)) {
              storyService.selectLayer($scope.storyLayers[0]);
            }
          }
        });

        $scope.$on('chapter-switch', function(event, chapterId) {
          if (goog.isDefAndNotNull($scope.mapService)) {
            setActiveChapter(chapterId);
            $scope.storyLayers = $scope.mapService.getStoryLayers(true, true);
          }
        });

        $scope.$on('chapter-add-config', function(event, data) {
          $scope.addChapterToMenu(chapter_index);
        });

        $('body').on('show.bs.modal', function(e) {
          var modals = $('.modal.in');
          var backdrops = $('.modal-backdrop');
          for (var i = 0; i < modals.length; i++) {
            modals.eq(i).css('z-index', 760 - (modals.length - i) * 20);
            backdrops.eq(i).css('z-index', 750 - (modals.length - i) * 20);
          }
          $(e.target).css('z-index', 760);
        });

        var errorDialogShowing = false;
        onErrorCallback = function(msg) {
          if (goog.isDefAndNotNull(ignoreNextScriptError) && ignoreNextScriptError &&
              msg.indexOf('Script error') > -1) {
            ignoreNextScriptError = false;
            return;
          }
          if (errorDialogShowing) {
            return;
          }
          errorDialogShowing = true;
          console.log('==== onErrorCallback, error msg:', msg);
          var msg_string = msg;
          if (typeof msg != 'string') {
            msg_string = 'message not string. view console for object detail';
          }
          dialogService.error($translate.instant('error'), $translate.instant('script_error',
              {error: msg_string})).then(function() {
            errorDialogShowing = false;
          });
        };

        // Enable Proj4JS and add projection definitions
        ol.HAVE_PROJ4JS = ol.ENABLE_PROJ4JS && typeof proj4 == 'function';

        // load the predefined projections available when there is no network connectivity
        if (ol.HAVE_PROJ4JS === true) {
          maploomProj4Defs(proj4.defs);
        }

        $scope.mapService = mapService;
        $scope.storyService = storyService;
        $scope.layerService = layerService;
        $scope.refreshService = refreshService;
        $scope.boxService = boxService;
        $scope.pinService = pinService;
        $scope.historyService = historyService;
        $scope.serverService = serverService;
        $scope.box = {};
        $scope.pin = {};
        $scope.pinFile = null;

        $rootScope.application = { name: $window.site_name || 'MapLoom', icon: $window.site_icon };

        $scope.handleBulkPinUpload = function(event) {
          var csv_reader = new FileReader();
          csv_reader.addEventListener('loadend', function() {
            $scope.pinFile = csv_reader.result;
          });
          for (var iFile = 0; iFile < event.target.files.length; iFile += 1) {
            var file = event.target.files[iFile];

            if (file.type === 'text/csv') {
              csv_reader.readAsText(file);
            }
          }

        };

        $scope.uploadBulkPins = function() {
          if ($scope.pinFile !== null) {
            $scope.pinFile = CSV2JSON($scope.pinFile);
            $scope.pinService.bulkPinAdd($scope.pinFile, $scope.active_menu_chapter.id);
            $scope.pinFile = null;
            $scope.updateMenuSection('storyPins' + $scope.active_menu_chapter.id);
          }
        };

        $scope.initBasemap = function() {
          var baseMaps = mapService.getBaseMaps();
          for (var iMap = 0; iMap < baseMaps.length; iMap += 1) {
            var config = baseMaps[iMap].get('metadata').config;
            if (goog.isDefAndNotNull(config.visibility) && config.visibility === true) {
              return baseMaps[iMap];
            }
          }
        };

        $scope.addStoryBox = function(box) {
          var clone = angular.copy(box);
          goog.object.extend(clone, {'id': new Date().getUTCMilliseconds()});
          if (boxService.addBox(clone, $scope.active_menu_chapter.id)) {
            $scope.box = {};
            $scope.updateMenuSection('storyBoxes' + $scope.active_menu_chapter.id);
          }
        };

        $scope.removeStoryBox = function(box) {
          boxService.removeBox(box, $scope.active_menu_chapter.id).then(function(removedID) {
            if (removedID !== null) {
              $scope.updateMenuSection('storyBoxes' + $scope.active_menu_chapter.id);
            }
          });
        };

        $scope.removeStoryPin = function(pin) {
          pinService.removePin(pin, $scope.active_menu_chapter.id).then(function(removedID) {
            if (removedID !== null) {
              $scope.updateMenuSection('storyPins' + $scope.active_menu_chapter.id);
            }
          });
        };

        $scope.addStoryPin = function(pin) {
          var clone = angular.copy(pin);
          goog.object.extend(clone, {'id': new Date().getUTCMilliseconds()});
          if (pinService.addPin(clone, $scope.active_menu_chapter.id) === true) {
            $scope.pin = {};
            $scope.updateMenuSection('storyPins' + $scope.active_menu_chapter.id);
            toastr.success('Your StoryPin has been saved', 'StoryPin Saved');
            $scope.mapService.removeDraw();
            $scope.mapService.removeSelect();
            $scope.mapService.removeModify();
            $scope.mapService.map.removeLayer($scope.mapService.editLayer);
          }
        };

        $scope.mapstories = {
          name: storyService.title,
          chapters: []
        };

        $scope.active_menu_chapter = null;
        $scope.prev_menu_section = null;
        $scope.menuSection = 'mainMenu';
        $scope.storyLayers = mapService.getStoryLayers();

        $scope.redirect = function(address) {
          window.top.location.href = address;
        };

        $scope.updateMenuSection = function(updateMenuSection) {
          if (updateMenuSection == 'mainMenuHidden') {
            $scope.prev_menu_section = $scope.menuSection;
          }
          $scope.menuSection = updateMenuSection;
          if (updateMenuSection.startsWith('selectedChapter')) {
            var re = /(\d+)/;
            var chapter_index = updateMenuSection.match(re);
            $scope.active_menu_chapter = $scope.mapstories.chapters[chapter_index[0]];
          } else if (updateMenuSection == 'mainMenu') {
            $scope.active_menu_chapter = null;
            $scope.storyService.clearSelectedItems();
          }
        };

        $scope.reorderLayer = function(startIndex, endIndex) {
          var length = mapService.map.getLayers().getArray().length - 1;
          var layer = mapService.map.removeLayer(mapService.map.getLayers().item(length - startIndex));
          mapService.map.getLayers().insertAt(length - endIndex, layer);
        };

        $scope.locations = {};

        $http.get('/api/regions/').success(function(data) {
          $scope.locations = data.objects;
        });

        $http.get('/api/categories/').success(function(data) {
          function isActive(category) {
            return category.is_choice;
          }
          $scope.categories = data.objects.filter(isActive);
        });

        $scope.isShown = true;

        $scope.toggleSidebar = function() {
          $scope.isShown = !$scope.isShown;
          if ($scope.menuSection == 'mainMenuHidden') {
            $scope.updateMenuSection($scope.prev_menu_section);
            document.getElementById('pushobj').style.width = '80%';
          } else {
            $scope.updateMenuSection('mainMenuHidden');
            document.getElementById('pushobj').style.width = '100%';
          }
          $scope.mapService.updateMapSize();
        };

        $scope.openLink = function(url, target) {
          $window.open(url, target);
        };

        $scope.styleChanged = function(layer) {
          layer.on('change:type', function(evt) {
            mapService.updateStyle(evt.target, $scope.activeChapterId);
          });
          mapService.updateStyle(layer, $scope.activeChapterId);
        };

        $scope.updateTourStep = function(step) {
          if (hopscotch.getState()) {
            hopscotch.showStep(step);
            setTimeout(function() {
              hopscotch.refreshBubblePosition();
            }, 1);
          }
        };

        $scope.removeChapter = function() {
          storyService.remove_chapter().then(function(removed_index) {
            if (removed_index !== null) {
              var num_chapters = $scope.mapstories.chapters.length;
              for (var iChapter = removed_index + 1; iChapter < num_chapters; iChapter += 1) {
                $scope.mapstories.chapters[iChapter].chapter = 'Chapter ' + (iChapter);
                $scope.mapstories.chapters[iChapter].id -= 1;
              }
              //Remove front end chapter from menu
              $scope.mapstories.chapters.splice(removed_index, 1);
              $scope.storyService.update_active_config($scope.mapstories.chapters[0].id, true);
              $scope.updateMenuSection('mainMenu');
            }
          });

        };

        $scope.removeLayer = function() {
          storyService.removeLayer().then(function(layer_removed) {
            if (layer_removed === true) {
              $scope.storyLayers = $scope.mapService.getStoryLayers();
              $scope.updateMenuSection('storyLayers' + $scope.active_menu_chapter.id);
              storyService.active_layer = null;
            }
          });
        };

        $scope.addChapter = function() {
          //Add chapter to backend story service will return new chapter ID or null if failure
          var new_index = storyService.add_chapter();
          if (new_index !== null) {
            $scope.addChapterToMenu(new_index);
            //Change focus to chapter info for newly created chapter
            $scope.updateMenuSection('chapterInfo' + new_index);
          }
        };

        $scope.addStorylayerToMenu = function(chapter_index, layer_config) {
          console.log('layer to add:', layer_config);
          var add_index = $scope.mapstories.chapters[chapter_index].storyLayers.length;
          var new_layer = {
            id: add_index,
            title: layer_config.title || 'Untitled Layer'
          };
          $scope.mapstories.chapters[chapter_index].storyLayers.push(new_layer);

        };

        $scope.editSingleStoryLayer = function(layerName) {

        };
        //front end initialization of new chapter on menu element
        $scope.addChapterToMenu = function(index) {
          var new_chapter_item = {
            id: index,
            chapter: 'Chapter ' + (index + 1),
            title: storyService.configurations[index].about.title,
            summary: storyService.configurations[index].about.abstract,
            storyLayers: [],
            storyBoxes: [],
            storyPins: []
          };

          //Add new chapter to sidebar menu
          $scope.mapstories.chapters.push(new_chapter_item);

        };

        $scope.isEditModeActive = function() {
          // Grab the URL in a variable.
          var locationParameters = $location.search();
          // Check to see if edit mode is in the URL.
          if (locationParameters['mode'] === 'edit') {
            // If edit mode is in the URL, get the value of the layer parameter.
            $scope.layerName = locationParameters['layer'];
            $scope.updateMenuSection('editSingleStoryLayer' + $scope.layerName);
            toastr.success('Layer is Loading...', '', {
              'timeOut': '0',
              'extendedTimeOut': '0'
            });
          }
        };
        for (var iChapter = 0; iChapter < $scope.storyService.configurations.length; iChapter += 1) {
          $scope.addChapterToMenu(iChapter);
        }

        $scope.isEditModeActive();

        $scope.treeOptions = {
          accept: function(sourceNodeScope, destNodesScope, destIndex) {
            return true;
          },
          dropped: function(event) {
            function updateChaptersList(value, index) {
              value.chapter = 'Chapter ' + (index + 1);
              value.id = index;
            }
            storyService.reorder_chapter(event.source.index, event.dest.index);
            $scope.mapstories.chapters.forEach(updateChaptersList);
          }
        };

        $scope.layerTree = {
          accept: function(sourceNodeScope, destNodesScope, destIndex) {
            return true;
          },
          dropped: function(event) {
            $scope.reorderLayer(event.source.index, event.dest.index);
          }
        };

        $scope.redirect = function(url) {
          $window.top.location.href = url;
        };

      });

  module.provider('debugService', function() {
    this.$get = function() {
      return this;
    };

    this.showDebugButtons = false;
  });

  module.provider('$exceptionHandler', function() {
    this.$get = function(errorLogService) {
      return errorLogService;
    };
  });

  module.factory('errorLogService', function($log, $window) {
    function log(exception, cause) {
      $log.error.apply($log, arguments);
      onErrorCallback(exception.toString());
    }
    // Return the logging function.
    return log;
  });

  module.config(function($translateProvider) {
    $translateProvider.preferredLanguage('en');
  });
}());
