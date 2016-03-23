(function() {
  var module = angular.module('loom_pin_service', []);
  var pins_ = [[]];
  var service_ = null;
  var rootScope_ = null;
  //var q_ = null;
  var httpService_ = null;
  //var exclusiveModeService_ = null;
  //var mapService_ = null;
  //var translate_ = null;
  //var dialogService_ = null;
  var Pin = function(data) {
    var copyData = angular.copy(data);
    delete data.geometry;
    ol.Feature.call(this, data);
    this.properties = data;
    this.setGeometry(new ol.geom.Point(copyData.geometry.coordinates));
    this.start_time = getTime(this.start_time);
    this.end_time = getTime(this.end_time);

  };
  Pin.prototype = Object.create(ol.Feature.prototype);
  Pin.prototype.constructor = Pin;
  var model_attributes = ['title', 'id', '_id', 'content', 'start_time', 'end_time', 'in_map', 'in_timeline'];

  model_attributes.forEach(function(prop) {
    Object.defineProperty(Pin.prototype, prop, {
      get: function() {
        var val = this.get(prop);
        return typeof val === 'undefined' ? null : val;
      },
      set: function(val) {
        this.set(prop, val);
      }
    });
  });

  module.provider('pinService', function() {
    this.$get = function($rootScope, $http) {
      service_ = this;
      rootScope_ = $rootScope;
      httpService_ = $http;

      $rootScope.$on('chapter-added', function(event, config) {
        console.log('---Pin Service: chapter-added');
        pins_.push([]);
      });

      $rootScope.$on('chapter-removed', function(event, chapter_index) {
        console.log('---Pin Service: chapter-removed', chapter_index);
        pins_.splice(chapter_index, 1);
      });
      // when a map is saved, save the boxes.
      $rootScope.$on('map-saved', function(event, config) {
        console.log('----[ pinService, notified that the map was saved', config);
        httpService_.post('/maps/' + config.map.id + '/annotations', new ol.format.GeoJSON().writeFeatures(pins_[config.chapter_index], {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'})).success(function(data) {
          console.log('----[ pinService, saved. ', data);
          return 'success';
        });
      });

      $rootScope.$on('map-created', function(event, config) {
        if (goog.isDefAndNotNull(config) && goog.isDefAndNotNull(config.id)) {
          console.log('----[ pinService, map created. initializing', config);
          httpService_({
            url: '/maps/' + config.map.id + '/annotations',
            method: 'GET'
          }).then(function(result) {
            console.log(result);
            var geojson = result.data;
            geojson.features.map(function(f) {
              var props = f.properties;
              props.start_time *= 1000;
              props.end_time *= 1000;
              var storyPin = new Pin(props);
              service_.addPin(storyPin);
            });
          });
        }
      });

      return service_;
    };

    this.getPins = function(chapter_index) {
      return pins_[chapter_index];
    };

    this.removePin = function(storyPin, chapter_index) {

      for (var i = 0; i < pins_[chapter_index].length; i++) {
        if (storyPin._id == pins_[chapter_index][i]._id) {
          pins_[chapter_index].splice(i, 1);
          break;
        }
      }

    };

    this.addPin = function(props, chapter_index) {
      var storyPin = new Pin(props);
      pins_[chapter_index].push(storyPin);
      rootScope_.$broadcast('pin-added', chapter_index);
      console.log('-- pinService.addPin, added: ', storyPin);
    };


    this.updatePin = function(pin, chapter_index) {
      //Only set new geometry if location was saved on pin object
      if (goog.isDefAndNotNull(pin.geometry)) {
        var newGeom = new ol.geom.Point(pin.geometry.coordinates);
        pin.setGeometry(newGeom);
      }
      rootScope_.$broadcast('pin-added', chapter_index);
      toastr.success('Your StoryPin has been saved', 'StoryPin Saved');
    };

  });
}());
