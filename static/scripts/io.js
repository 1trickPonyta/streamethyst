const urlParams = new URLSearchParams(window.location.search);
let overlayName = urlParams.get("overlay");
if (!overlayName) overlayName = "";

let socket = io();

socket.on("sound", data => {
	playSound(`/audio/${data.path}`, data.volume, data.loop);
});

socket.on("visual", data => {
	let main = document.getElementById("main");
	
	let visual = document.createElement(data.tagName);
	visual.id = data.id;
	if (data.className) visual.className = data.className;

	if (data.style) {
		Object.keys(data.style).forEach(key => {
			visual.style[key] = data.style[key];
		});
	}
	
	visual.style.display = "block";
	visual.style.position = "absolute";
	visual.style.left = `${data.x}px`;
	visual.style.top = `${data.y}px`;
	
	if (data.html) visual.innerHTML = data.html;
	
	if (data.props) {
		Object.keys(data.props).forEach(key => {
			visual[key] = data.props[key];
		});
	}
	
	visual.transitionData = data.transition;
	
	if (visual.transitionData && visual.transitionData.into) {
		let transition = visual.transitionData.into;
		
		visual.style.transitionDuration = `${transition.seconds}s`;
		if (transition.timing) visual.style.transitionTimingFunction = transition.timing;
		
		let startTransition = () => {};
		
		switch (transition.type) {
			case "fade":
				visual.style.transitionProperty = "opacity";
				let originalOpacity = visual.style.opacity;
				visual.style.opacity = 0;
				startTransition = () => visual.style.opacity = originalOpacity;
				break;
			case "slide":
				visual.style.transitionProperty = "left";
				switch (transition.direction) {
					case "left":
						visual.style.left = `${document.body.scrollWidth}px`;
						startTransition = () => visual.style.left = `${data.x}px`;
						break;
					case "right":
						visual.style.left = `-${visual.style.width}`;
						startTransition = () => visual.style.left = `${data.x}px`;
						break;
				}
				break;
			default:
				console.error(`Invalid transition: ${transition.type}`);
				break;
		}
		
		main.appendChild(visual);
		
		// Must add artificial delay before setting transition properties to final values
		window.setTimeout(startTransition, 60);
		
	} else {
		
		main.appendChild(visual);
		
	}
});

socket.on("remove-visual", data => {
	let main = document.getElementById("main");
	
	let visual = document.getElementById(data.id);
	if (!visual) {
		console.log(`No visual with id ${data.id}`);
		return;
	}
	
	if (visual.transitionData && visual.transitionData.out) {
		let transition = visual.transitionData.out;
		
		visual.style.transitionDuration = `${transition.seconds}s`;
		if (transition.timing) visual.style.transitionTimingFunction = transition.timing;
		
		let startTransition = () => {};
		
		switch (transition.type) {
			case "fade":
				visual.style.transitionProperty = "opacity";
				startTransition = () => visual.style.opacity = 0;
				break;
			case "slide":
				visual.style.transitionProperty = "left";
				switch (transition.direction) {
					case "left":
						startTransition = () => visual.style.left = `-${visual.style.width}`;
						break;
					case "right":
						startTransition = () => visual.style.left = `${document.body.scrollWidth}px`;
						break;
				}
				break;
			default:
				console.error(`Invalid transition: ${transition.type}`);
				break;
		}
		
		
		// Must add artificial delay before setting transition properties to final values
		window.setTimeout(startTransition, 60);
		
		window.setTimeout(() => visual.parentNode.removeChild(visual), 60 + transition.seconds*1000);
		
	} else {
		
		visual.parentNode.removeChild(visual);
		
	}
});

socket.on("style", data => {
	let style = document.createElement("style");
	style.id = data.id;
	style.innerHTML = data.css;
	document.head.appendChild(style);
});

socket.on("remove-style", data => {
	let style = document.getElementById(data.id);
	if (style) {
		document.head.removeChild(style);
	}
});

socket.on("script", data => {
	let io = {
		signal: (id, data={}) => {
			socket.emit("signal", {
				id: id,
				data: data
			});
		},
		
		playSound: (path, volume, loop) => playSound(`/audio/${path}`, volume, loop)
	};
	
	Function(`"use strict"; return io => {${data.code}};`)()(io);
});
