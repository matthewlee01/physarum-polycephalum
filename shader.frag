precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_grid;
uniform sampler2D u_noise;

uniform float u_temperature;
uniform float u_wind;
uniform float u_pressure;
uniform float u_humidity;

varying vec2 vTexCoord;

void main() {
    vec2 tex_coord = vec2(vTexCoord.x, 1.0-vTexCoord.y);
    vec2 tex_offset = 1.0 / u_resolution;

    vec4 color = texture2D(u_grid, tex_coord);

    float noise = texture2D(u_noise, tex_coord).r * 0.3 ;
    
    gl_FragColor = vec4(step(noise, color.r) * color.xyz, 0.5);
}