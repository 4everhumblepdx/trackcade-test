# Decoded analysis versus listening-player time coordinates

Analysis timestamps refer to the frozen, untrimmed mono PCM sample-zero coordinate.
The local HTML media element reports a different total duration for the three private
MP3s. This is not proof of a constant leading offset; encoder delay/padding and
container duration reporting are unresolved. No correction, trim, resampling change,
rerun or gameplay approval was introduced after the external freeze.

|Track|PCM seconds|Media seconds|Difference seconds|
|---|---:|---:|---:|
|alldat|196.075102|196.075100|0.000002|
|cvb|309.420408|309.420408|0.000000|
|laid-back|171.206531|171.062600|0.143931|
|need-a-bag|233.351837|233.154500|0.197337|
|wanna-get-lit|230.504490|230.309600|0.194890|

Listening seeks are approximate inspection aids, not independently verified PERFECT
centers. The time mapping between the private originals and their PCM timestamps
requires independent validation before any production use. All real trusted timing
counts and anchor eligibility remain zero.
