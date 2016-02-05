(function() {
  var module = angular.module('loom_story_service', ['ngCookies']);
  var service_ = null;
  var mapservice_ = null;
  var configservice_ = null;

  module.provider('storyService', function() {

    this.$get = function($window, $http, $cookies, $location, $translate, mapService, configService) {
      service_ = this;
      mapservice_ = mapService;
      configservice_ = configService;

      //When initializing the story service the mapService should already be initialized
      this.title = 'New Mapstory';
      this.abstract = 'This is the default summary';
      this.category = null;
      this.is_published = false;
      this.configurations = [];
      this.configurations.push(mapservice_.configuration);
      this.active_index = 0;
      this.active_chapter = this.configurations[this.active_index];
      this.id = this.active_chapter.story_id;

      return this;
    };

    this.save = function() {
      //TODO: When saving the mapstory we must go through each configuration and perform a save on the mapService
      for (var iConfig = 0; iConfig < this.configurations; iConfig += 1) {
        var configToSave = this.configurations[iConfig];
        configToSave['chapter_index'] = iConfig;
        mapservice_.configuration = configToSave;
        mapservice_.save();
      }

      //TODO: After saving all maps we need to save the possible changed data from storyService
    };

    this.get_chapter_config = function(index) {
      return this.configurations[index];
    };

    this.update_active_config = function(index) {
      //This function updates the active_chapter and propagates the new
      //active configuration to the other services.
      this.active_chapter = this.configurations[index];
      this.active_index = index;
      //All services (except mapservice) use configServices configuration
      configservice_.configuration = this.active_chapter;

      //TODO: This should be handled through updating the configService configuration
      mapservice_.configuration = this.active_chapter;
      mapservice_.updateActiveMap(this.active_index);

    };

    this.change_chapter = function(chapter_index) {
      service_.update_active_config(chapter_index);
    };

    this.next_chapter = function() {
      var nextChapter = this.active_index + 1;
      if (nextChapter > this.configurations.length - 1) {
        nextChapter = 0;
      }
      service_.update_active_config(nextChapter);
    };

    this.prev_chapter = function() {
      var prevChapter = this.active_index - 1;
      if (prevChapter < 0) {
        prevChapter = 0;
      }
      service_.update_active_config(prevChapter);
    };

    this.add_chapter = function() {
      //TODO: Add new config object that is clone of current without layers, boxes, or pins
      //TODO: This will also need to switch the document focus to the new map and chapter in the menu
      console.log('Adding chapter');
      var new_chapter = mapservice_.createNewChapter();
      new_chapter['story_id'] = service_.id;
      this.configurations.push(new_chapter);
      service_.update_active_config(this.configurations.length - 1);

      // Update the front end push menu
      var $addTo = $('#menu').multilevelpushmenu('activemenu').first();
      var addChapter = [
        {
          name: 'Chapter ' + (this.configurations.length - 1),
          link: '#',
          items: [
            {
              title: 'Chapter ' + (this.configurations.length - 1),
              icon: 'fa fa-bookmark',
              items: [
                {
                  name: 'Chapter Info',
                  icon: 'fa fa-info-circle',
                  link: '#'
                },
                {
                  name: 'StoryLayers',
                  icon: 'fa fa-clone',
                  link: '#'
                },
                {
                  name: 'StoryBoxes',
                  icon: 'fa fa-object-group',
                  link: '#'
                },
                {
                  name: 'StoryPins',
                  icon: 'fa fa-neuter',
                  link: '#'
                },
                {
                  name: 'Delete Chapter',
                  id: 'deleteChapter',
                  icon: 'fa fa-trash-o',
                  link: '#'
                }
              ]
            }
          ]
        }
      ];
      $('#menu').multilevelpushmenu('additems', addChapter, $addTo, 0);
    };

    this.remove_chapter = function() {
      //TODO: After removing a chapter we will need to switch focus to the base level of menu
      this.configurations.splice(this.active_index, 1);
      if (this.configurations.length > 0) {
        this.update_active_config(0);
      }
    };

  });


}());
