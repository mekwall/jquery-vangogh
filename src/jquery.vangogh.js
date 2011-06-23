(function($, window, hljs){
    // one can become many
    var painters = 1,
        waitForLoad = false,
        waitForSource = false;

    // hey vincent!
    $.fn.vanGogh = function(options){
        var defaults = {
            language: "auto",
            firstLine: 1,
            maxLines: 0,
            numbers: true,
            highlight: null,
            animateGutter: true,
            autoload: "http://softwaremaniacs.org/media/soft/highlight/highlight.pack.js",
            tab: "    ",
        };
        // merge defaults and passed options
        options = $.extend({}, defaults, options);
        
        // scope vars
        var elems = this,
            run = 0,
            currentHash = window.location.hash,
            remoteData;
        
        // cross-browser compatible selection
        function selectCode(elm) {
            var w = window,
                d = window.document;
            if (d.body.createTextRange) {
                var range = d.body.createTextRange();
                range.moveToElementText(elm);
                range.select();
            } else if (d.createRange) {
                var sel = w.getSelection(),
                    range = d.createRange();
                range.selectNodeContents(elm);
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }
        
        // this function puts Van Gogh into action
        function paint() {
            // check if we're waiting for ajax request
            if (waitForLoad || waitForSource) {
                setTimeout(paint, 100);
                return;
            }
            run++;
            // abort if run 10 times or more
            if (run >= 10) { return; }
            // load remote source
            if (options.source && !remoteData) {
                waitForSource = true;
                $.ajax({
                    url: options.source,
                    crossDomain: true,
                    dataType: "text",
                    success: function(result){
                        remoteData = result;
                    },
                    error: function(xhr, textStatus){
                        remoteData = "ERROR: "+textStatus;
                    },
                    complete: function() {
                        waitForSource = false;
                        paint();
                    }
                });
                return;
            }
            hljs = hljs || window.hljs;
            if (!hljs) {
                // autoload highlight.js
                waitForLoad = true;
                $.getScript(options.autoload, function(){
                    waitForLoad = false;
                    paint();
                });
                return;
            }
            // iterate passed elements
            elems.filter("pre,code").each(function(){
                var self = $(this)
                        .addClass("vg-container")
                        .attr("id", this.id || "vg-"+painters++),
                    id = this.id,
                    container = self.find("code"),
                    inline = false,
                    lastClicked = false;
                
                // if there's no code element,
                // assume it's self and inline
                if (!container.length) {
                    container = self;
                    inline = true;
                }
                
                // put remote data in container
                (options.source && remoteData) && container.text(remoteData);
                
                // copy the original text
                var original = container.text();
               
                // fire off highlight.js
                hljs.highlightBlock(container[0], options.tab);

                // split the result into lines so that we can process them
                var lines = container.html().split("\n"),
                    numbers = "",
                    code = "";
                
                // highlight a line/word/phrase
                function highlight(num, clear, initial){
                    var oldHash = window.location.hash.substring(1),
                        addHash = "",
                        range = false,
                        lines = self.find(".vg-line");
                    
                    // clear all previous highlights
                    if (clear) {
                        // remove class
                        self.find(".vg-highlight").removeClass("vg-highlight");
                        // remove from hash
                        oldHash = oldHash.replace(new RegExp('([#]?'+id+'-[0-9]+[,]?)','g'), "");
                    }
                    
                    // check for range in string
                    if (typeof num === "string") {
                        var match = num.match(/^([0-9]+)-([0-9]+)$/);
                        if (match) {
                            num = [];
                            var from = match[1], to = match[2];
                            for (var i = from; i <= to; i++) {
                                num.push(i);
                            }
                            // TODO: ranges in hash
                            //range = true;
                            //addHash += ','+id+'-'+from+'-'+to;
                        } else {
                            // check for word/phrase
                            self.find(".vg-line:contains("+num+")").each(function(){
                                var line = $(this).addClass("vg-highlight");
                                line.html(line.html().replace(num, '<span class="vg-highlight">'+num+'</span>'));
                            });
                            return;
                        }
                    } else if (typeof num === "number") {
                        num = [num];
                    }
                    $.each(num, function(){
                        var lineId = id+'-'+this,
                            line = lines.filter('#'+lineId);
                            
                        // line found
                        if (line.length) {
                            line.addClass("vg-highlight");
                            if (!range) { addHash += ','+lineId; }
                        }
                    });
                    // add hash
                    if (!initial) {
                        window.location.hash = oldHash.length ?
                            '#'+oldHash+addHash :
                            '#'+addHash.substring(1);
                    }
                }
                
                // if not inline and there are multiple lines
                if (!inline) {
                    // iterate the lines
                    $.each(lines, function(i, line){
                        var num = i+options.firstLine,
                            lineId = id+'-'+num;
                        // if numbers is enabled, add number to gutter
                        if (options.numbers) {
                            numbers += '<a class="vg-number" rel="#'+lineId+'">'+num+'</a>';
                        }
                        // wrap the line
                        code += '<div class="vg-line" id="'+lineId+'">'+line+'</div>';
                    });
                    // wrap all lines
                    code = '<code class="vg-code">'+code+'</code>';
                    // add gutter to container if numbers is enabled
                    if (options.numbers) { 
                        code = '<div class="vg-gutter" unselectable="on">'+numbers+'</div>'+code;
                    }
                    // put new code in container
                    self.html(code);
                    // reset the container since we just replaced the original element
                    container = self.find("code");
                    // we want numbersto be clickable
                    self.find(".vg-number").click(function(e){  
                        var number = $(this),
                            rel = number.attr("rel"),
                            line = self.find(rel);
                        
                        // check if already highlighted
                        if (line.hasClass("vg-highlight")) {
                            var oldHash = window.location.hash,
                                newHash = oldHash;
                            // remove highlight
                            line.removeClass("vg-highlight");
                            // remove from hash
                            window.location.hash = oldHash.replace(
                                new RegExp('([#,]?'+rel.substring(1)+'[,]?)'),
                                ''
                            );
                            lastClicked = false;
                            return false;
                        }

                        var prevClicked = lastClicked;
                        lastClicked = parseInt(rel.match(/-([0-9]+)$/)[1]);
                        
                        // handle shift-click to allow selecting range
                        if (e.shiftKey && lastClicked) {
                            highlight(
                                prevClicked < lastClicked ?
                                    prevClicked+'-'+lastClicked :
                                    lastClicked+'-'+prevClicked,
                                true
                            );
                        } else {
                            // handle ctrl-click to allow multiple highlightings
                            highlight(lastClicked, e.ctrlKey ? false : true);
                        }
                        return false;
                    });
                    
                    var gutter = self.find(".vg-gutter"),
                        gutterWidth = gutter.outerWidth(),
                        oldLeft = 0,
                        scrollTimer = false;
                    
                    // animate gutter on horizontal scroll
                    if (options.animateGutter) {
                        self.scroll(function(e){
                            if (this.scrollLeft === oldLeft) { return; }
                            else if (this.scrollLeft <= gutterWidth) {
                                oldLeft = this.scrollLeft;
                                clearTimeout(scrollTimer);
                                scrollTimer = false;
                                gutter.css({
                                    "float": "",
                                    "position": "",
                                    "left": ""
                                }).show();
                            } else if (this.scrollLeft < oldLeft) {
                                oldLeft = this.scrollLeft;
                                gutter.hide();
                            } else if (this.scrollLeft !== oldLeft) {
                                if (scrollTimer) { return; }
                                var elm = this;
                                oldLeft = this.scrollLeft;
                                scrollTimer = setTimeout(function(){
                                    scrollTimer = false;
                                    var scrollLeft = elm.scrollLeft;
                                    container.css("marginLeft", gutterWidth);
                                    gutter.css({
                                        "float": "none",
                                        "position": "absolute",
                                        "left": scrollLeft-gutterWidth
                                    }).show().stop().animate({ left: scrollLeft });
                                }, 500);
                            }
                        });
                    }
                    
                } else if (inline) {
                    self.addClass("vg-code");
                }
                
                // double-clicking the container will select all code (if supported)
                container.dblclick(function(){
                    selectCode(container[0]);
                    return false;
                });
                
                if (options.maxLines > 0) {
                    var lineHeight = self.find(".vg-line").height()
                        newHeight =
                            lineHeight*(options.maxLines+1)+
                            parseInt(container.css("paddingTop"));
                    self.height(newHeight);
                }
                
                // highlight rows passed in options
                options.highlight && highlight(options.highlight, true, true);
                // highlight lines that exist in hash
                var hashLines = currentHash.match(new RegExp('('+id+'-[0-9]+)','g'));
                hashLines &&
                    self.find('#'+hashLines.join(",#")).each(function(i){
                        highlight(parseInt(this.id.match(/-([0-9]+)$/)[1]), (i === 0));
                    });
            });
        }
        // let the master begin
        paint();
        // return elements
        return elems;
    }
        
})(jQuery, this, (typeof this.hljs !== "undefined") ? this.hljs : false);