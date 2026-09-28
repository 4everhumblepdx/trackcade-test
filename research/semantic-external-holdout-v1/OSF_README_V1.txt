1. Download the dataset
- Download mp3s_soundcloud_cc_event_detection.zip and all the mp3s_soundcloud_cc_event_detection.z[01-18] into a folder of your choice (Let's call it HOME, for example)

2. Extract the mp3s
- Go to the HOME folder and select the file mp3s_soundcloud_cc_event_detection.zip
- Using a program like 7-zip (or Winzip), extract the mp3s_soundcloud_cc_event_detection.zip
- This will create a sub-folder by the name "mp3s_soundcloud_cc_event_detection" in your HOME folder and this contains all the mp3s and the corresponding annotations.

3. Annotations for the events: drop, build and break
- Each mp3 file in the folder "mp3s_soundcloud_cc_event_detection" contains a corresponding ".mat" file (matlab structure), which contains the starting and ending points of the above mentioned events.
- Structure of the mat file:
	- drop: Contains a list of timestamps (in seconds) of the drops in the song
	- build_start: An array containing the starting timestamps (in seconds) of the builds in the song
	- build_end: An array containing the ending timestamps (in seconds) of the builds in the song
	- break_start: An array containing the starting timestamps (in seconds) of the breaks in the song
	- break_end: An array containing the ending timestamps (in seconds) of the breaks in the song
	- drop_tc: Timestamps of timed comments containing a reference to a drop
	- build_tc: Timestamps of timed comments containing a reference to a build
	- break_tc: Timestamps of timed comments containing a reference to a break
	- drop, build_start, build_end, break_start, break_end are labelled by experts
	- Size of the arrays build_start and build_end should be the same. Example: build_start = [40,190] and build_end = [52, 201]. These arrays mean that there is a build from 40 to 52 seconds in the song and another build is from 190 to 201 seconds.
	- Size of the arrays break_start and break_end should be the same. Example: break_start = [80,310] and build_end = [103, 329]. These arrays mean that there is a break from 80 to 103 seconds in the song and another break is from 310 to 329 seconds.

4. Statistics
- Total number of tracks: 402
- Total number of drops: 435
- Total number of drop timed comments: 604
- Total number of builds: 596
- Total number of build timed comments: 609
- Total number of breaks: 372
- Total number of break timed comments: 619

4. Reference
- If you use this dataset, please refer to the following paper:
K. Yadati, M.A. Larson, C.C.S. Liem, A. Hanjalic “Detecting Socially Significant Music Events using Temporally Noisy Labels”, IEEE Transactions on Multimedia.