(function($, window, hljs){
    // one can become many
    var painters = 1,
        waitForLoad = false,
        waitForSource = false;
    
    // tool to parse/manipulate hash
    var hashTool = {
        get: function(id) {
            var hash = window.location.hash;
            if (hash.length > 0) {
                var match = hash.match(new RegExp(id+":{([a-zA-Z0-9,-]*)}"));
                if (match) {
                    return match[1].split(",");
                }
            }
            return [];
        },
        set: function(id, hl) {
            var hash = window.location.hash,
                newHash, addHash = id+":{"+hl.join(",")+"}",
                match = hash.indexOf(id+":{");
            
            if (hl.length === 0) {
                return this.remove(id);
            }
            if (match !== -1) {
                newHash = hash.replace(
                    new RegExp("("+id+":{[a-zA-Z0-9,-]*})"),
                    addHash
                );
            } else {
                newHash = (hash.length > 0) ? hash+","+addHash : addHash;
            }
            window.location.hash = newHash;
        },
        remove: function(id) {
            window.location.hash = window.location.hash.replace(
                new RegExp("([,]?"+id+":{[a-zA-Z0-9,-]*}[,]?)"),
                ""
            );
        }
    };
	
	// precompile regex patterns
	var rxp = {
		numberRange: /^([0-9]+)-([0-9]+)$/,
		pageNumber: /-([0-9]+)$/,
		multilineBegin: /<span class="([\w-_][^"]+)">(?:.[^<]*(?!<\/span>)|)$/ig,
		multilineEnd: /(<span class="([\w-_][^"]+)">)?(?:.[^<]*)?(<\/span>)/ig
	};

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
            tab: "    "
        };
        // merge defaults and passed options
        options = $.extend({}, defaults, options);
        
        // scope vars
        var elems = this,
            run = 0,
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
                    lastClicked = false,
                    highlighted = [];
                
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
                    var range = false,
                        lines = self.find(".vg-line");
                    
                    // clear all previous highlights
                    if (clear) {
                        // remove class
                        self.find(".vg-highlight").removeClass("vg-highlight");
                        // remove from hash
                        hashTool.remove(id);
                        // clear highlighted array
                        highlighted = [];
                    }
                    
                    // if not array, make it into one
                    num = ($.type(num) === "array") ? 
                        num : [num];

                    // iterate array
                    $.each(num, function(i, hl){
                        // if already highlighted, do nothing
                        if (highlighted.indexOf(hl) > -1) { return; }
                        // convert to int if string is number
                        if (!isNaN(parseFloat(hl, 10)) && isFinite(hl)) {
                            hl = parseInt(hl, 10);
                        }
                        // handle strings
                        if ($.type(hl) === "string") {
                            // check for range
                            var match = rxp.numberRange.exec(hl);
                            if (match) {
                                var from = match[1], to = match[2], range = "";
                                for (var i = from; i <= to; i++) {
                                    range += ',#'+id+'-'+i;
                                    highlighted.push(i);
                                }
                                lines.filter(range.substring(1)).addClass("vg-highlight");
                            } else {
                                // check for word/phrase
                                self.find(".vg-line:contains("+hl+")").each(function(){
                                    var line = $(this).addClass("vg-highlight");
                                    line.html(line.html().replace(hl, '<span class="vg-highlight">'+hl+'</span>'));
                                });
                                highlighted.push(hl);
                            }
                        } else {
                            var lineId = id+'-'+this,
                            line = lines.filter('#'+lineId);
                                
                            // line found
                            if (line.length) {
                                line.addClass("vg-highlight");
                                highlighted.push(hl);
                            }
                        }
                    });
                    // update hash
                    !initial && hashTool.set(id, highlighted);
                }
                
                // if not inline
                if (!inline) {
                    // iterate the lines
					var multiline = {},
						level = 0;
                    $.each(lines, function(i, line){
                        var num = i+options.firstLine,
                            lineId = id+'-'+num,
							newLine = line;
                        // if numbers is enabled, add number to gutter
                        if (options.numbers) {
                            numbers += '<a class="vg-number" rel="#'+lineId+'">'+num+'</a>';
                        }
						// check if in multiline mode
						if (multiline[level]) {
							// check for closing tag
							var end = rxp.multilineEnd.exec(line);
							// simulate a negative lookbehind by forcing first group not to match
							if (end && !end[1]) {
								// closing tag found
								newLine = '<span class="'+multiline[level]+'">'+newLine;
								// down a level
								delete multiline[level];
								level--;
							} else {
								// we're still on the same level
								newLine = '<span class="'+multiline[level]+'">'+newLine+'</span>';
							}
						}
						// detect and retain multiline styles
						// (inline languages, multi-line comments etc.)
						var match = rxp.multilineBegin.exec(line);
						if (match) {
							// up a level
							level++;
							// store current style
							multiline[level] = match[1];
						}
                        // wrap the line
                        code += '<div class="vg-line" id="'+lineId+'">'+newLine+'</div>';
                    });
                    // wrap all lines
                    code = '<code class="vg-code">'+code+'</code>';
                    // add gutter to container if numbers is enabled
                    if (options.numbers) { 
                        code = '<div class="vg-gutter">'+numbers+'</div>'+code;
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
                            // remove highlight class
                            line.removeClass("vg-highlight");
                            // remove from highlighted
                            highlighted.splice(highlighted.indexOf(number.text()), 1);
                            // update hash
                            hashTool.set(id, highlighted);
                            lastClicked = false;
                            return false;
                        }

                        var prevClicked = lastClicked;
                        lastClicked = parseInt(rxp.pageNumberexec(rel)[1], 10);
                        
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
					var lineHeight = self.find(".vg-line").height(),
						padding = parseInt(container.css("paddingTop")),
						newHeight = lineHeight*(options.maxLines+1)+padding;
					self.css({
						minHeight: lineHeight+padding,
						maxHeight: newHeight
					});
                }
                
                // highlight rows passed in options
                options.highlight && highlight(options.highlight, true, true);
                // highlight lines that exist in hash
                var hashLines = hashTool.get(id);
                hashLines.length && highlight(hashLines, false, true);
            });
        }
        // let the master begin
        paint();
        // return elements
        return elems;
    }
        
})(jQuery, this, (typeof this.hljs !== "undefined") ? this.hljs : false);