/* TODO
- start with camera pointed straight up, as if daydreaming
- play with noise parameters
- dotted line in middle of road?
- water?
*/

if (!Detector.webgl) {
  Detector.addGetWebGLMessage();
  document.getElementById( 'container' ).innerHTML = "";
}

var container, stats;

var camera, controls, scene, renderer;

var mesh, texture, truck;

var worldWidth = 256, worldDepth = 256,
worldHalfWidth = worldWidth / 2, worldHalfDepth = worldDepth / 2;

var clock = new THREE.Clock();

var inner_road = 92;
var outer_road = 100;

init();
animate();

function init() {

  container = document.getElementById( 'container' );

  camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 1, 10000 );
  //camera.lookAt(new THREE.Vector3(0, 10, 0));
  
  controls = new THREE.FirstPersonControls(camera);
  controls.movementSpeed = 0;
  controls.lookSpeed = 0.1;

  scene = new THREE.Scene();
  //scene.fog = new THREE.FogExp2(0xefd1b5, 0.0025);
  scene.fog = new THREE.FogExp2(0xefd1b5, 0.00125);

  data = generateHeight(worldWidth, worldDepth);
  data = makeRingRoad(worldWidth, worldDepth, inner_road, outer_road, data);

  camera.position.y = data[ worldHalfWidth + worldHalfDepth * worldWidth ] * 10 + 50;
  // what's mapping from texture to mesh?
  camera.position.z = 2828;

  // model
  var manager = new THREE.LoadingManager();
  manager.onProgress = function ( item, loaded, total ) {
    console.log( item, loaded, total );
  };
  var onProgress = function (xhr) {
    if (xhr.lengthComputable) {
      var percentComplete = xhr.loaded / xhr.total * 100;
      console.log( Math.round(percentComplete, 2) + '% downloaded' );
    }
  };  
  var onError = function (xhr) {};


  var loader = new THREE.OBJLoader(manager);
  loader.load('http://localhost:8000/autonomous-truck-simulator-2017/truck.obj', function (object) {
    object.traverse( function ( child ) {
      // if ( child instanceof THREE.Mesh ) {
      //   child.material.map = texture;
      // }
    });


    truck = object;
    
    object.position.x = camera.position.x + 3;
    object.position.z = camera.position.z;
    object.position.y = camera.position.y - 10;

    object.rotation.y = -Math.PI / 2;

    scene.add(object);

    var light = new THREE.PointLight(0xff0000, 1, 100);
    light.position.x = object.position.x - 1;
    light.position.y = object.position.y + 3;
    light.position.z = object.position.z;
    light.position.y += 3;
    scene.add(light);
  }, onProgress, onError );


  
  var geometry = new THREE.PlaneBufferGeometry( 7500, 7500, worldWidth - 1, worldDepth - 1 );
  geometry.rotateX(-Math.PI / 2);

  var vertices = geometry.attributes.position.array;

  for (var i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {
    vertices[j + 1] = data[i] * 10;
  }

  texture = new THREE.CanvasTexture(generateTexture(data, worldWidth, worldDepth));
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;

  mesh = new THREE.Mesh( geometry, new THREE.MeshBasicMaterial( { map: texture } ) );
  scene.add( mesh );

  renderer = new THREE.WebGLRenderer();
  renderer.setClearColor( 0xefd1b5 );
  renderer.setPixelRatio( window.devicePixelRatio );
  renderer.setSize( window.innerWidth, window.innerHeight );

  container.innerHTML = "";

  container.appendChild( renderer.domElement );

  stats = new Stats();
  container.appendChild( stats.dom );


  //

  window.addEventListener( 'resize', onWindowResize, false );

}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);

  controls.handleResize();
}

function generateHeight(width, height) {
  let size = width * height, data = new Uint8Array(size),
  perlin = new ImprovedNoise(), quality = 1,
  z = Math.random() * 100;

  for (var j = 0; j < 4; j++) {
  //for (var j = 0; j < 6; j++) {
    for (var i = 0; i < size; i++) {
      let x = i % width, y = ~~ (i / width);
      //data[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality * .5);
      //data[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality * 1.75);
      data[i] += Math.abs(perlin.noise(x / quality, y / quality, z) * quality);
    }
    quality *= 5;
  }

  return data;
}


function makeRingRoad(width, height, inner_radius, outer_radius, data) {
  let size = width * height;
  let half_height = height / 2, half_width = width / 2;
  
  for (var j = 0; j < 4; j++) {
    for (var i = 0; i < size; i++) {
      var x = i % width, y = ~~ (i / width);
      let radius = Math.sqrt(Math.pow(x - half_width, 2) + Math.pow(y - half_height, 2));
      if (radius >= inner_radius && radius <= outer_radius) {
        data[i] = data[half_width + half_height * width];
      } 
    }
  }

  return data;
}

function generateTexture( data, width, height ) {
  var canvas, canvasScaled, context, image, imageData,
  level, diff, vector3, sun, shade;

  vector3 = new THREE.Vector3( 0, 0, 0 );

  sun = new THREE.Vector3( 1, 1, 1 );
  sun.normalize();

  canvas = document.createElement( 'canvas' );
  canvas.width = width;
  canvas.height = height;

  context = canvas.getContext( '2d' );
  context.fillStyle = '#000';
  context.fillRect( 0, 0, width, height );

  image = context.getImageData( 0, 0, canvas.width, canvas.height );
  imageData = image.data;

  for ( var i = 0, j = 0, l = imageData.length; i < l; i += 4, j ++ ) {
    vector3.x = data[ j - 2 ] - data[ j + 2 ];
    vector3.y = 2;
    vector3.z = data[ j - width * 2 ] - data[ j + width * 2 ];
    vector3.normalize();

    shade = vector3.dot( sun );

    imageData[ i ] = ( 96 + shade * 128 ) * ( 0.5 + data[ j ] * 0.007 );
    imageData[ i + 1 ] = ( 32 + shade * 96 ) * ( 0.5 + data[ j ] * 0.007 );
    imageData[ i + 2 ] = ( shade * 96 ) * ( 0.5 + data[ j ] * 0.007 );
  }

  context.putImageData(image, 0, 0);

  // Scaled 4x

  canvasScaled = document.createElement( 'canvas' );
  canvasScaled.width = width * 4;
  canvasScaled.height = height * 4;

  context = canvasScaled.getContext( '2d' );
  context.scale( 4, 4 );
  context.drawImage( canvas, 0, 0 );

  image = context.getImageData( 0, 0, canvasScaled.width, canvasScaled.height );
  imageData = image.data;

  for ( var i = 0, l = imageData.length; i < l; i += 4 ) {

    var v = ~~ ( Math.random() * 5 );

    imageData[ i ] += v;
    imageData[ i + 1 ] += v;
    imageData[ i + 2 ] += v;

  }

  context.putImageData( image, 0, 0 );

  return canvasScaled;
}

//

function animate() {
  mesh.rotation.y -= 0.0025;

  requestAnimationFrame(animate);
  render();
  stats.update();
}


function render() {
  controls.update(clock.getDelta());
  renderer.render(scene, camera);
}
