precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform sampler2D u_grid;
uniform sampler2D u_noise;

uniform float u_temperature;
uniform float u_wind;
uniform float u_pressure;
uniform float u_moisture;

varying vec2 vTexCoord;

void main() {
    vec2 tex_coord = vec2(vTexCoord.x, 1.0-vTexCoord.y);
    vec2 tex_offset = 1.0 / u_resolution;

    float noise = texture2D(u_noise, tex_coord).r * (0.1 + 0.5 * (1.0-u_moisture));
    float value = texture2D(u_grid, tex_coord).r;
    
    float s = step(noise, value);

    vec4 color = vec4(
        0.1 + pow(0.9 * u_temperature, 1.5),
        0.8,
        0.1 + pow(0.9 * (1.0-u_temperature), 1.5),
        0.5
    );
    gl_FragColor = vec4(s*color.rgb*(value+noise/8.0), 0.5) + (1.0-s)*vec4(color.rgb*0.3, 0.5);
}